import { useEffect, useState } from 'react'

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true

    const dismissed = localStorage.getItem('labs-install-dismissed') === '1'
    if (isStandalone || dismissed) return undefined

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallEvent(event)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!visible || !installEvent) return null

  const install = async () => {
    installEvent.prompt()
    await installEvent.userChoice
    setVisible(false)
    setInstallEvent(null)
  }

  const dismiss = () => {
    localStorage.setItem('labs-install-dismissed', '1')
    setVisible(false)
  }

  return (
    <div className="install-prompt" role="status">
      <div>
        <strong>Install Labs Burger</strong>
        <span>Open it full-screen from your phone home screen.</span>
      </div>
      <button type="button" onClick={install}>Install</button>
      <button type="button" onClick={dismiss} aria-label="Dismiss install prompt">x</button>
    </div>
  )
}
