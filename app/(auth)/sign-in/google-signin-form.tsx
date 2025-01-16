'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { SignInWitGoogle } from '@/lib/actions/user.actions'

export function GoogleSignInForm() {
  const SignInButton = () => {
    const { pending } = useFormStatus()

    return (
      <Button disabled={pending} className='w-full' variant='outline'>
        {pending ? 'Redirecting to Google...' : 'Sign in with Google'}
      </Button>
    )
  }

  return (
    <form action={SignInWitGoogle}>
      <SignInButton />
    </form>
  )
}
