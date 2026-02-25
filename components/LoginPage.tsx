import React, { useState } from 'react';
import { Building2, Lock, User as UserIcon, Loader2, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
  isLoading: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simple mock validation
    if (username === 'admin' && password === 'admin') {
      onLogin();
    } else {
      setError('Username atau password salah. (Coba: admin / admin)');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col md:flex-row max-w-4xl h-auto md:h-[500px]">
        
        {/* Left Side - Branding */}
        <div className="bg-brand-600 p-8 md:w-1/2 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-brand-900 opacity-20 transform -skew-y-12 scale-150 origin-bottom-right"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-6">
               <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Sembilan Bintang Abadi</h1>
            <p className="text-brand-100 text-sm">Sistem Manajemen Terpadu Absensi, Gaji, & Material Proyek.</p>
          </div>
          <div className="relative z-10 text-xs text-brand-200 mt-8 md:mt-0">
            &copy; 2026 SBA Management System
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="p-8 md:w-1/2 flex flex-col justify-center bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Login Aplikasi</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <div className="relative">
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  placeholder="Masukkan password"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menghubungkan ke Cloud...
                </>
              ) : (
                <>
                  Masuk Aplikasi
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};