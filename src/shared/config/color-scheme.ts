import { createContext, use } from 'react'

export const ColorSchemeContext = createContext<{ dark: boolean, setDark: (dark: boolean) => void }>({
  dark: false,
  setDark: () => {},
})

export const useColorScheme = () => use(ColorSchemeContext)
