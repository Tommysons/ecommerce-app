import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { sendPurchaseReceipt } from '@/emails'
import Order from '@/lib/db/models/order.model'
import { connectToDatabase } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('stripe-signature') as string

    console.log('Webhook payload:', payload)
    console.log('Webhook signature:', signature)
    connectToDatabase(process.env.MONGODB_URI)
    const event = await stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )

    console.log('Webhook event type:', event.type)

    if (event.type === 'charge.succeeded') {
      const charge = event.data.object
      console.log('Charge object:', charge)

      const orderId = charge.metadata.orderId
      const email = charge.billing_details.email
      const pricePaidInCents = charge.amount

      console.log('Order ID:', orderId)
      console.log('Email:', email)
      console.log('Price paid:', pricePaidInCents)

      const order = await Order.findById(orderId)
        .populate('user', 'email')
        .maxTimeMS(30000)
      if (order == null) {
        console.error('Order not found:', orderId)
        return new NextResponse('Order not found', { status: 400 })
      }

      order.isPaid = true
      order.paidAt = new Date()
      order.paymentResult = {
        id: event.id,
        status: 'COMPLETED',
        email_address: email!,
        pricePaid: (pricePaidInCents / 100).toFixed(2),
      }

      await order.save()
      console.log('Order updated:', order)

      try {
        await sendPurchaseReceipt({ order })
        console.log('Purchase receipt email sent')
      } catch (err) {
        console.error('Email error:', err)
      }

      return NextResponse.json({ message: 'Order updated successfully' })
    }

    console.log('Unhandled event type:', event.type)
    return new NextResponse('Unhandled event type', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new NextResponse('Webhook error', { status: 400 })
  }
}
