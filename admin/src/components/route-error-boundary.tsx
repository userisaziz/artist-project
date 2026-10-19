import { Component, type ReactNode } from 'react'
import { ErrorState } from '@/components/error-state'

interface RouteErrorBoundaryProps {
  children: ReactNode
  /** Changing it (e.g. the pathname) clears a caught error, so navigating away recovers. */
  resetKey?: string
  fullPage?: boolean
}

interface RouteErrorBoundaryState {
  error: Error | null
  resetKey: string | undefined
}

/**
 * Catches render errors in one route region and shows a Retry fallback instead of a blank app.
 * The error is not swallowed: React still reports every caught error (createRoot's onCaughtError).
 * A class component because React has no hook equivalent of getDerivedStateFromError.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(props: RouteErrorBoundaryProps, state: RouteErrorBoundaryState): Partial<RouteErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <ErrorState
        title="This page couldn’t be shown"
        description="Something went wrong while displaying it. Retry, or pick another page."
        onRetry={this.retry}
        fullPage={this.props.fullPage}
      />
    )
  }
}
