import { Routes, Route, Navigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import Login from './pages/Login'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Modules from './pages/Modules'
import Articles from './pages/Articles'
import Reports from './pages/Reports'
import Updates from './pages/Updates'

export default function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/"        element={<Login />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/modules"  element={<Modules />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/reports"  element={<Reports />} />
        <Route path="/updates"  element={<Updates />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  )
}
