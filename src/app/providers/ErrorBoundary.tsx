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
          extra={
            <Button onClick={() => window.location.reload()} type="primary">
              Перезагрузить страницу
            </Button>
          }
          status="error"
          subTitle="Перезагрузите страницу. Сессия и данные текущего запуска будут сброшены."
          title="Не удалось отобразить приложение"
        />
      )
    }

    return this.props.children
  }
}
