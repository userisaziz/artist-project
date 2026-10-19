import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { useRequestOtp, useVerifyOtp } from './api'
import signInPhoto from '@/assets/admin-signin.webp'

// Atelier hi-fi "Admin sign in": photo panel on the left, the form on the right.
// The design's email/password + authenticator steps map onto our phone + SMS code
// (product decision, 2026-10-10); the panel's live stats are left out before sign-in.

const COUNTRY = '+91'

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
const pretty = (national: string) => `${COUNTRY} ${national.slice(0, 5)} ${national.slice(5)}`

export function LoginPage() {
  const { signIn } = useAuth()
  const requestCode = useRequestOtp()
  const verifyCode = useVerifyOtp()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [national, setNational] = useState('')
  const [code, setCode] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const busy = requestCode.isPending || verifyCode.isPending

  const digits = national.replace(/\D/g, '')

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault()
    if (digits.length !== 10) return setError('Enter your 10-digit mobile number.')
    setError(null)
    requestCode.mutate(`${COUNTRY}${digits}`, {
      onSuccess: () => {
        if (step === 'code') setResent(true)
        setCode('')
        setStep('code')
      },
      onError: (err) => setError(message(err)),
    })
  }

  const verify = (value: string) => {
    if (value.length !== 6) return setError('Enter the 6-digit code.')
    setError(null)
    verifyCode.mutate(
      { phone: `${COUNTRY}${digits}`, code: value, keepSignedIn },
      {
        onSuccess: signIn, // status flips → GuestOnly guard routes into the console
        onError: (err) => {
          setError(err instanceof ApiError && err.code === 'auth_error' ? 'That code is incorrect.' : message(err))
          setCode('')
        },
      },
    )
  }

  return (
    <div className="flex min-h-svh bg-blush">
      <aside className="relative hidden w-[560px] shrink-0 overflow-hidden lg:block">
        <img src={signInPhoto} alt="" className="absolute inset-0 size-full object-cover object-[45%_30%]" />
        <div className="absolute inset-0 bg-linear-to-b from-plum/15 via-plum/35 to-plum-deep/92" />
        <div className="absolute top-9 left-10 text-[23.4px] font-semibold tracking-[-0.025em] text-white">Atelier</div>
        <div className="absolute right-10 bottom-10 left-10 text-white">
          <div className="text-[10.5px] font-bold tracking-[0.24em]">ADMIN CONSOLE</div>
          <div className="mt-2.5 text-[31px] leading-[1.02] font-semibold tracking-[-0.025em]">
            Keep the marketplace <i className="font-medium">beautiful.</i>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          {step === 'phone' ? (
            <form onSubmit={(e) => sendCode(e)} noValidate>
              <Heading eyebrow="STAFF SIGN IN" title="Welcome" accent="back." />
              <p className="mt-2.5 text-[13.5px] text-subtle-foreground">Sign in with your staff phone number.</p>

              <label htmlFor="phone" className="mt-6 block text-[12.5px] font-semibold text-subtle-foreground">Phone number</label>
              <div
                className={cn(
                  'mt-1.5 flex h-12 items-center gap-3 rounded-xl border bg-card px-3.5 text-[14.5px] transition-shadow',
                  'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-halo',
                  error ? 'border-destructive' : 'border-border',
                )}
              >
                <span className="font-semibold whitespace-nowrap">{COUNTRY}</span>
                <span className="h-5 w-px bg-border" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="98860 12345"
                  value={national}
                  aria-invalid={!!error}
                  onChange={(e) => { setNational(e.target.value); setError(null) }}
                  className="h-auto flex-1 rounded-none border-0 bg-transparent p-0 text-[14.5px] text-foreground placeholder:text-placeholder focus-visible:ring-0 aria-invalid:ring-0 md:text-[14.5px]"
                />
              </div>
              <ErrorText>{error}</ErrorText>

              <Checkbox checked={keepSignedIn} onChange={setKeepSignedIn}>Keep me signed in on this device</Checkbox>
              <PrimaryButton type="submit" disabled={busy}>{busy ? 'Sending code…' : 'Sign in'}</PrimaryButton>
              <p className="mt-[18px] text-xs leading-normal text-muted-foreground">
                Access is limited to Atelier staff. Every sign-in is confirmed with a one-time code.
              </p>
            </form>
          ) : (
            <div>
              <Button
                variant="link"
                onClick={() => { setStep('phone'); setError(null); setResent(false) }}
                className="h-auto gap-1 p-0 text-[13px] font-semibold hover:no-underline"
              >
                <ChevronLeft className="size-4" /> Back
              </Button>
              <div className="mt-[18px]"><Heading eyebrow="VERIFICATION" title="Enter your" accent="code." /></div>
              <p className="mt-2.5 text-[13.5px] text-subtle-foreground">We texted a 6-digit code to {pretty(digits)}.</p>

              <InputOTP
                maxLength={6}
                value={code}
                autoFocus
                disabled={busy}
                aria-label="6-digit code"
                onChange={(v) => { setCode(v); setError(null) }}
                onComplete={(v: string) => verify(v)}
                containerClassName="mt-6"
              >
                <InputOTPGroup className="gap-2.5">
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      aria-invalid={!!error}
                      className="h-[58px] w-[52px] rounded-xl border border-border bg-card text-[22px] font-bold first:rounded-xl last:rounded-xl data-[active=true]:border-2 data-[active=true]:border-primary data-[active=true]:ring-4 data-[active=true]:ring-halo"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <ErrorText>{error}</ErrorText>

              <PrimaryButton type="button" disabled={busy} onClick={() => verify(code)}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </PrimaryButton>
              <p className="mt-4 text-[12.5px] text-muted-foreground">
                {resent ? 'A new code is on its way. ' : 'Didn’t get it? '}
                <Button variant="link" disabled={busy} onClick={() => sendCode()} className="h-auto p-0 text-[12.5px] font-semibold hover:text-foreground hover:no-underline">
                  Resend code
                </Button>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Heading({ eyebrow, title, accent }: { eyebrow: string; title: string; accent: string }) {
  return (
    <>
      <div className="text-[10.5px] font-bold tracking-[0.24em] text-primary">{eyebrow}</div>
      <h1 className="mt-2.5 text-[29.6px] leading-none font-semibold tracking-[-0.025em] text-plum-deep">
        {title} <i className="font-medium text-primary">{accent}</i>
      </h1>
    </>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p role="alert" className="mt-2 text-[12.5px] font-medium text-destructive">{children}</p> : null
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px] select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          'flex size-5 items-center justify-center rounded-md border-[1.5px] text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-halo',
          checked ? 'border-primary bg-primary' : 'border-input bg-card',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}

function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn('mt-[22px] h-12 w-full rounded-xl text-[14.5px] font-semibold hover:bg-primary/90 disabled:opacity-60', className)} />
}
