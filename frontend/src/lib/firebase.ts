import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId?: string
  appId: string
}

let firebaseApp: FirebaseApp | null = null
let firebaseStorage: FirebaseStorage | null = null

const readEnvOrThrow = (key: string): string => {
  const value = import.meta.env[key] as string | undefined
  if (!value) {
    throw new Error(`${key} 환경 변수가 필요합니다.`)
  }
  return value
}

const getFirebaseConfig = (): FirebaseConfig => {
  return {
    apiKey: readEnvOrThrow('VITE_FIREBASE_API_KEY'),
    authDomain: readEnvOrThrow('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnvOrThrow('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnvOrThrow('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: readEnvOrThrow('VITE_FIREBASE_APP_ID'),
  }
}

export const getFirebaseApp = (): FirebaseApp => {
  if (firebaseApp) return firebaseApp

  // HMR/리로드로 인해 init이 중복되지 않게 처리
  if (getApps().length > 0) {
    firebaseApp = getApps()[0]!
    return firebaseApp
  }

  firebaseApp = initializeApp(getFirebaseConfig())
  return firebaseApp
}

export const getFirebaseStorage = (): FirebaseStorage => {
  if (firebaseStorage) return firebaseStorage

  firebaseStorage = getStorage(getFirebaseApp())
  return firebaseStorage
}
