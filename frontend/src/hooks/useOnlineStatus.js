import { useState, useEffect } from 'react'
import { addOnlineListener } from '../utils/syncEngine.js'

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => addOnlineListener(setIsOnline), [])
  return isOnline
}
