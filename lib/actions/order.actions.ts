'use server'
import { Cart, OrderItem, ShippingAddress } from '@/types'
import { formatError, round2 } from '../utils'
import { AVAILABLE_DELIVERY_DATES } from '../constats'
import { connectToDatabase } from '../db'
import { auth } from '@/auth'
import { OrderInputSchema } from '../validator'
import Order, { IOrder } from '../db/models/order.model'
import { revalidatePath } from 'next/cache'
import { sendPurchaseReceipt } from '@/emails'
import { paypal } from '../paypal'

//Create
export const createOrder = async (clientSideCart: Cart) => {
  try {
    await connectToDatabase()
    const session = await auth()
    if (!session) throw Error('User not authorized')
    //recalculate price and delivery date on the server
    const createOrder = await createOrderFromCart(
      clientSideCart,
      session.user.id!
    )
    return {
      success: true,
      message: 'Order placed successfully',
      data: { orderId: createOrder._id.toString() },
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export const createOrderFromCart = async (
  clientSideCart: Cart,
  userId: string
) => {
  const cart = {
    ...clientSideCart,
    ...calcDeliveyDateAndPrice({
      items: clientSideCart.items,
      shippingAddress: clientSideCart.shippingAddress,
      deliveryDateIndex: clientSideCart.deliveryDateIndex,
    }),
  }

  const order = OrderInputSchema.parse({
    user: userId,
    items: cart.items,
    shippingAddress: cart.shippingAddress,
    paymentMethod: cart.paymentMethod,
    itemsPrice: cart.itemsPrice,
    shippingPrice: cart.shippingPrice,
    taxPrice: cart.taxPrice,
    totalPrice: cart.totalPrice,
    expectedDeliveryDate: cart.expectedDeliveryDate,
  })

  return await Order.create(order)
}

export async function getOrderById(orderId: string): Promise<IOrder> {
  await connectToDatabase()
  const order = await Order.findById(orderId)
  return JSON.parse(JSON.stringify(order))
}

export async function createPayPalOrder(orderId: string) {
  await connectToDatabase()
  try {
    const order = await Order.findById(orderId)
    if (order) {
      const paypalOrder = await paypal.createOrder(order.totalPrice)
      order.paymentResult = {
        id: paypalOrder.id,
        email_address: '',
        status: '',
        pricePaid: '0',
      }
      await order.save()
      return {
        success: true,
        message: 'PayPal order created successfully',
        data: paypalOrder.id,
      }
    } else {
      throw new Error('Order not found')
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

export async function approvePayPalOrder(
  orderId: string,
  data: { orderID: string }
) {
  await connectToDatabase()
  try {
    const order = await Order.findById(orderId).populate('user', 'email')
    if (!order) throw new Error('Order not found')

    const captureData = await paypal.capturePayment(data.orderID)
    if (
      !captureData ||
      captureData.id !== order.paymentResult?.id ||
      captureData.status !== 'COMPLETED'
    )
      throw new Error('Error in paypal payment')
    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: captureData.id,
      status: captureData.status,
      email_address: captureData.payer.email_address,
      pricePaid:
        captureData.purchase_units[0]?.payments?.captures[0]?.amount?.value,
    }
    await order.save()
    await sendPurchaseReceipt({ order })
    revalidatePath(`/account/orders/${orderId}`)
    return {
      success: true,
      message: 'Your order has been successfully paid by PayPal',
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

export const calcDeliveyDateAndPrice = async ({
  items,
  shippingAddress,
  deliveryDateIndex,
}: {
  deliveryDateIndex?: number
  items: OrderItem[]
  shippingAddress?: ShippingAddress
}) => {
  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )
  const deliverDate =
    AVAILABLE_DELIVERY_DATES[
      deliveryDateIndex === undefined
        ? AVAILABLE_DELIVERY_DATES.length - 1
        : deliveryDateIndex
    ]
  const shippingPrice =
    !shippingAddress || !deliverDate
      ? undefined
      : deliverDate.freeShippingMinPrice > 0 &&
          itemsPrice >= deliverDate.freeShippingMinPrice
        ? 0
        : deliverDate.shippingPrice

  const taxPrice = !shippingAddress ? undefined : round2(itemsPrice * 0.15)
  const totalPrice = round2(
    itemsPrice +
      (shippingPrice ? round2(shippingPrice) : 0) +
      (taxPrice ? round2(taxPrice) : 0)
  )
  return {
    AVAILABLE_DELIVERY_DATES,
    deliveryDateIndex:
      deliveryDateIndex === undefined
        ? AVAILABLE_DELIVERY_DATES.length - 1
        : deliveryDateIndex,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  }
}
