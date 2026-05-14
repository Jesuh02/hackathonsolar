'use client';

import { useState } from 'react';
import { whatsappApi } from '@/lib/api/whatsapp.api';
import { WhatsAppVerificationState } from '@/types/whatsapp.types';

type Step = 'phone' | 'otp' | 'success';

interface Props {
  onVerified: (state: WhatsAppVerificationState) => void;
  onClose: () => void;
}

export function WhatsAppOtpModal({ onVerified, onClose }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!phone.trim()) { setError('Ingresa un número de teléfono'); return; }
    setError('');
    setLoading(true);
    try {
      await whatsappApi.sendOtp({ phone: phone.trim() });
      setStep('otp');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al enviar el código. Intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (code.length !== 6) { setError('El código debe tener 6 dígitos'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await whatsappApi.verifyOtp({ phone: phone.trim(), code });
      if (res.verified) {
        setStep('success');
        setTimeout(() => {
          onVerified({ isVerified: true, phone: res.phone });
          onClose();
        }, 1800);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Código incorrecto. Intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4 flex items-center gap-3">
          <span className="text-3xl">💬</span>
          <div>
            <h2 className="text-white font-bold text-lg">Verificación WhatsApp</h2>
            <p className="text-green-200 text-xs">Agente Solar · Riohacha</p>
          </div>
          <button onClick={onClose} className="ml-auto text-green-200 hover:text-white text-xl font-bold leading-none">×</button>
        </div>

        <div className="px-6 py-6 space-y-5">
          {step === 'phone' && (
            <>
              <p className="text-gray-300 text-sm">
                Ingresa tu número con código de país para recibir tu código de verificación por WhatsApp.
              </p>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Número de WhatsApp</label>
                <input
                  type="tel"
                  placeholder="+57 300 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
                  disabled={loading}
                />
              </div>
              {error && <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                {loading ? '⏳ Enviando...' : '📲 Enviar código por WhatsApp'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="text-center">
                <div className="text-4xl mb-2">📲</div>
                <p className="text-gray-300 text-sm">
                  Enviamos un código de 6 dígitos a
                </p>
                <p className="text-green-400 font-semibold mt-1">{phone}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Código de verificación</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-center text-xl font-mono tracking-widest"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Válido por 10 minutos</p>
              </div>
              {error && <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <button
                onClick={handleVerifyOtp}
                disabled={loading || code.length !== 6}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                {loading ? '⏳ Verificando...' : '✅ Verificar código'}
              </button>
              <button
                onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                className="w-full text-gray-400 hover:text-gray-300 text-xs py-1"
              >
                ← Cambiar número
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-3">
              <div className="text-5xl">🎉</div>
              <p className="text-green-400 font-bold text-lg">¡Verificado!</p>
              <p className="text-gray-400 text-sm">
                Tu número <span className="text-white font-medium">{phone}</span> ha sido verificado.
                <br />Recibirás recomendaciones diarias de ahorro energético.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
