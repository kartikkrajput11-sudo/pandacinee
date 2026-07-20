/// Public backend config. The anon/publishable key is safe to ship in client code —
/// Row-Level Security enforces per-user access.
class Env {
  static const supabaseUrl = 'https://xedblspkninsobmqttwf.supabase.co';
  static const supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZGJsc3Brbmluc29ibXF0dHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Nzg1NzQsImV4cCI6MjA5NzI1NDU3NH0.WUxr_wx_bdgAWRsmEoCX7qpBUq8F-e11qke4DFL80DY';
}
