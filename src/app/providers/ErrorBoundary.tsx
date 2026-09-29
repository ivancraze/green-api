import { Button, Result } from 'antd'
import { Component, type PropsWithChildren } from 'react'

export class ErrorBoundary extends Component<PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Не удалось отобразить приложение"
          subTitle="Перезагрузите страницу. Сессия и данные текущего запуска будут сброшены."
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </Button>
          }
        />
      )
    }

    return this.props.children
  }
}
