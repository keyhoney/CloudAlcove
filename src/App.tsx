import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Room from './pages/Room'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
  )
}
