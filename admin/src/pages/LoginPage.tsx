import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import signInPhoto from '@/assets/admin-signin.webp'

// Atelier hi-fi "Admin sign in": photo panel on the left, the form on the right.
// The design's email/password + authenticator steps map onto our phone + SMS code
// (product decision, 2026-10-10); the panel's live stats are left out before sign-in.

const COUNTRY = '+91'

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
const pretty = (national: string) => `${COUNTRY} ${national.slice(0, 5)} ${national.slice(5)}`

export function LoginPage() {
  const { requestCode, verifyCode } = useAuth()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [national, setNational] = useState('')
  const [code, setCode] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const digits = national.replace(/\D/g, '')

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    if (digits.length !== 10) return setError('Enter your 10-digit mobile number.')
    setBusy(true)
    setError(null)
    try {
      await requestCode(`${COUNTRY}${digits}`)
      if (step === 'code') setResent(true)
      setCode('')
      setStep('code')
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (value: string) => {
    if (value.length !== 6) return setError('Enter the 6-digit code.')
    setBusy(true)
    setError(null)
    try {
      await verifyCode(`${COUNTRY}${digits}`, value, keepSignedIn)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'auth_error' ? 'That code is incorrect.' : message(err))
      setCode('')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh bg-[#FDF2F5]">
      <aside className="relative hidden w-[560px] shrink-0 overflow-hidden lg:block">
        <img src={signInPhoto} alt="" className="absolute inset-0 size-full object-cover object-[45%_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(122,47,85,.15)_0%,rgba(122,47,85,.35)_50%,rgba(74,27,51,.92)_100%)]" />
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
            <form onSubmit={(e) => { void sendCode(e) }} noValidate>
              <Heading eyebrow="STAFF SIGN IN" title="Welcome" accent="back." />
              <p className="mt-2.5 text-[13.5px] text-[#6E5262]">Sign in with your staff phone number.</p>

              <label htmlFor="phone" className="mt-6 block text-[12.5px] font-semibold text-[#6E5262]">Phone number</label>
              <div
                className={cn(
                  'mt-1.5 flex h-12 items-center gap-3 rounded-xl border bg-white px-3.5 text-[14.5px] transition-shadow',
                  'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-[#FCEEF3]',
                  error ? 'border-destructive' : 'border-[#F0CFDD]',
                )}
              >
                <span className="font-semibold whitespace-nowrap">{COUNTRY}</span>
                <span className="h-5 w-px bg-[#F0CFDD]" />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="98860 12345"
                  value={national}
                  aria-invalid={!!error}
                  onChange={(e) => { setNational(e.target.value); setError(null) }}
                  className="min-w-0 flex-1 bg-transparent text-[#49313B] outline-none placeholder:text-[#B293A3]"
                />
              </div>
              <ErrorText>{error}</ErrorText>

              <Checkbox checked={keepSignedIn} onChange={setKeepSignedIn}>Keep me signed in on this device</Checkbox>
              <PrimaryButton type="submit" disabled={busy}>{busy ? 'Sending code…' : 'Sign in'}</PrimaryButton>
              <p className="mt-[18px] text-xs leading-normal text-[#896F7D]">
                Access is limited to Atelier staff. Every sign-in is confirmed with a one-time code.
              </p>
            </form>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => { setStep('phone'); setError(null); setResent(false) }}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <div className="mt-[18px]"><Heading eyebrow="VERIFICATION" title="Enter your" accent="code." /></div>
              <p className="mt-2.5 text-[13.5px] text-[#6E5262]">We texted a 6-digit code to {pretty(digits)}.</p>

              <InputOTP
                maxLength={6}
                value={code}
                autoFocus
                disabled={busy}
                aria-label="6-digit code"
                onChange={(v) => { setCode(v); setError(null) }}
                onComplete={(v: string) => { void verify(v) }}
                containerClassName="mt-6"
              >
                <InputOTPGroup className="gap-2.5">
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      aria-invalid={!!error}
                      className="h-[58px] w-[52px] rounded-xl border border-[#F0CFDD] bg-white text-[22px] font-bold first:rounded-xl last:rounded-xl data-[active=true]:border-2 data-[active=true]:border-primary data-[active=true]:ring-4 data-[active=true]:ring-[#FCEEF3]"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <ErrorText>{error}</ErrorText>

              <PrimaryButton type="button" disabled={busy} onClick={() => { void verify(code) }}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </PrimaryButton>
              <p className="mt-4 text-[12.5px] text-[#896F7D]">
                {resent ? 'A new code is on its way. ' : 'Didn’t get it? '}
                <button type="button" disabled={busy} onClick={() => { void sendCode() }} className="font-semibold text-primary hover:text-[#49313B]">
                  Resend code
                </button>
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
      <h1 className="mt-2.5 text-[29.6px] leading-none font-semibold tracking-[-0.025em] text-[#4A1B33]">
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
          'flex size-5 items-center justify-center rounded-md border-[1.5px] text-white peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#FCEEF3]',
          checked ? 'border-primary bg-primary' : 'border-[#EBC3D5] bg-white',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}

function PrimaryButton(props: React.ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className="mt-[22px] flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[14.5px] font-semibold text-white transition-colors hover:bg-[#9F3F64] disabled:opacity-60"
    />
  )
}
