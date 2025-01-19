import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import React from 'react'
import { getOrderById } from '@/lib/actions/order.actions'
import PaymentForm from './payment-form'

export const metadata = {
  title: 'Payment',
}

const CheckoutPaymentPage = async (props: {
  params: Promise<{ id: string }>
}) => {
  const params = await props.params
  const { id } = params
  const order = await getOrderById(id)
  if (!order) return notFound()

  const session = await auth()

  return (
    <PaymentForm
      order={order}
      paypalClientId={process.env.PAYPAL_CLIENT_ID || 'sb'}
      isAdmin={session?.user?.role === 'Admin' || false}
    />
  )
}

export default CheckoutPaymentPage
