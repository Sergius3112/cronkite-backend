import { Routes, Route, Navigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import Login from './pages/Login'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Modules from './pages/Modules'
import Articles from './pages/Articles'
import Reports from './pages/Reports'
import Updates from './pages/Updates'
import StudentModules from './pages/StudentModules'
import ForYou from './pages/ForYou'

function Shell({ children }) {
  return <AppLayout>{children}</AppLayout>
}

export default function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/"             element={<Login />} />
        <Route path="/auth/callback" element={<Login />} />
        <Route path="/teacher" element={<Shell><TeacherDashboard /></Shell>} />
        <Route path="/student" element={<Shell><StudentDashboard /></Shell>} />
        <Route path="/modules"  element={<Shell><Modules /></Shell>} />
        <Route path="/articles" element={<Shell><Articles /></Shell>} />
        <Route path="/reports"  element={<Shell><Reports /></Shell>} />
        <Route path="/updates"          element={<Shell><Updates /></Shell>} />
        <Route path="/student/modules"   element={<Shell><StudentModules /></Shell>} />
        <Route path="/student/briefing" element={<Shell><Updates /></Shell>} />
        <Route path="/student/for-you"  element={<Shell><ForYou /></Shell>} />
        <Route path="/for-you"          element={<Shell><ForYou /></Shell>} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  )
}
