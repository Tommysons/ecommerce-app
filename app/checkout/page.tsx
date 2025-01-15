import { auth } from '@/auth'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Checkout:,',
}

export default async function CheckoutPage() {
  const session = await auth()
  if (!session) {
    redirect('/sign-in?callbackUrl=/checkout')
  }

  return <div>Chekout Form</div>
}