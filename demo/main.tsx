import { createRoot } from 'react-dom/client'

import { IllustrationsPage } from '@app/index'
import '@app/styles.css'
import './demo.css'

const root = document.querySelector('#root')

if (root === null) {
    throw new Error('Demo root element was not found')
}

createRoot(root).render(<IllustrationsPage />)
