import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Room, User } from "../types";
import Button, { ButtonVariant } from "../components/Button";
import { createBooking, payBooking } from "../services/oracleApiService";
import { Check, CheckCircle, CreditCard, Wallet, Calendar } from "lucide-react";
import ErrorAlert from "../components/ErrorAlert";

type Step = 1 | 2 | 3;

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // State from navigation
  const room = location.state?.room as Room;
  const startDate = location.state?.startDate as string;
  const endDate = location.state?.endDate as string;

  // Session User
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("session_user");
    if (!userStr || !room || !startDate || !endDate) {
      navigate("/");
      return;
    }
    setUser(JSON.parse(userStr));
  }, [navigate, room, startDate, endDate]);

  // Wizard State
  const [step, setStep] = useState<Step>(2); // Start at "Booking/Payment" step directly as per logic requirements
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  
  // Payment Data
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');

  // Calculations
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const totalAmount = (room?.basePrice || 0) * diffDays;

  // --- Handlers ---

  const handleProcessBooking = async () => {
    if (!user || !room) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Create Booking
      const createRes = await createBooking(user.username, room.roomNo, startDate, endDate);
      
      if (createRes.status === "OK" && createRes.data) {
        const bookingId = createRes.data;
        
        // 2. Process Payment
        // Mock transaction ref
        const transactionRef = `TX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const payRes = await payBooking(
          user.username, 
          bookingId, 
          totalAmount, 
          paymentMethod, 
          transactionRef
        );

        if (payRes.status === "OK") {
          setStep(3);
        } else {
          setError({ status: payRes.status, message: "Бронирование создано, но оплата не прошла: " + payRes.message });
        }

      } else {
        setError({ status: createRes.status, message: createRes.message });
      }
    } catch (err) {
      setError({ status: "ERROR", message: "Ошибка обработки заказа" });
    } finally {
      setLoading(false);
    }
  };

  if (!room || !user) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-3xl mx-auto px-4 py-12">
        
        {/* Stepper */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute top-1/4 left-6 h-1 bg-gray-200 -z-0" style={{width: '666px'}}></div>
          
          <div className={`relative z-10 flex flex-col items-center gap-2 text-primary`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 bg-background border-primary`}>
              <Check size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider bg-background px-2">Выбор</span>
          </div>
          
          <div className={`relative z-10 flex flex-col items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step >= 2 ? 'bg-background border-primary' : 'bg-gray-100 border-gray-300'}`}>
               {step > 2 ? <Check size={16} /> : 2}
            </div>
             <span className="text-xs font-bold uppercase tracking-wider bg-background px-2">Оформление</span>
          </div>
          
          <div className={`relative z-10 flex flex-col items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step >= 3 ? 'bg-background border-primary' : 'bg-gray-100 border-gray-300'}`}>
              3
            </div>
             <span className="text-xs font-bold uppercase tracking-wider bg-background px-2">Завершение</span>
          </div>
        </div>

        <ErrorAlert error={error} />

        {/* --- STEP 2: Checkout Form --- */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-lg border border-ui p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Summary */}
             <div className="mb-8 p-6 bg-ui/30 rounded-lg border border-ui">
                <h3 className="text-xl font-serif text-text mb-4">Детали бронирования</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">Номер</span>
                    <p className="font-bold text-lg">{room.title}</p>
                    <p className="text-sm text-text/60 font-mono">{room.roomNo}</p>
                  </div>
                  <div>
                     <span className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">Даты</span>
                     <div className="flex items-center gap-2 font-medium">
                       <Calendar size={18} className="text-primary"/>
                       {new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}
                     </div>
                     <p className="text-sm text-text/60 mt-1">{diffDays} ночей</p>
                  </div>
                </div>
             </div>

             <h2 className="text-xl font-serif text-text mb-6">Способ оплаты</h2>
             
             <div className="mb-8">
               <div className="bg-ui p-1 rounded-full relative flex h-14 cursor-pointer shadow-inner max-w-md mx-auto">
                  {/* Sliding Indicator */}
                  <div 
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-md transition-all duration-300 ease-in-out ${paymentMethod === 'CARD' ? 'left-1' : 'left-[calc(50%+4px)]'}`}
                  ></div>

                  {/* Buttons */}
                  <div 
                    className={`z-10 w-1/2 flex items-center justify-center gap-2 font-bold transition-colors duration-300 ${paymentMethod === 'CARD' ? 'text-primary' : 'text-text/50'}`}
                    onClick={() => setPaymentMethod('CARD')}
                  >
                    <CreditCard size={20} /> Карта
                  </div>
                  <div 
                    className={`z-10 w-1/2 flex items-center justify-center gap-2 font-bold transition-colors duration-300 ${paymentMethod === 'CASH' ? 'text-primary' : 'text-text/50'}`}
                    onClick={() => setPaymentMethod('CASH')}
                  >
                    <Wallet size={20} /> Наличные
                  </div>
               </div>
             </div>

             {paymentMethod === 'CARD' && (
               <div className="mb-8 opacity-100 transition-opacity duration-300 bg-blue-50 p-4 rounded-lg text-blue-800 text-sm text-center border border-blue-100">
                  Оплата картой будет произведена в тестовом режиме.
               </div>
             )}
             
             {paymentMethod === 'CASH' && (
                <div className="mb-8 text-center py-4 bg-gray-50 rounded-lg text-text/70 text-sm border border-gray-200">
                    Оплата наличными при заселении.
                </div>
             )}

             <div className="flex flex-col gap-4 border-t border-ui pt-6">
               <div className="flex justify-between items-center text-xl font-bold">
                 <span>Итого к оплате:</span>
                 <span className="text-primary">{totalAmount.toLocaleString()} ₽</span>
               </div>
               
               <Button 
                text="Оформить бронирование"
                className="w-full !py-4 text-lg mt-2"
                onClick={handleProcessBooking}
                isLoading={loading}
               />
             </div>
          </div>
        )}

        {/* --- STEP 3: Success --- */}
        {step === 3 && (
           <div className="bg-white rounded-xl shadow-lg border border-ui p-12 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} />
              </div>
              <h2 className="text-3xl font-serif text-text mb-4">Бронирование успешно!</h2>
              <p className="text-text/60 mb-8 max-w-md mx-auto">
                Ваш номер успешно забронирован. Мы ждем вас в Moonglow Hotel!
              </p>
              
              <div className="flex justify-center gap-4">
                <Button 
                  text="На главную"
                  variant={ButtonVariant.Tertiary}
                  onClick={() => navigate('/')}
                />
                <Button 
                  text="Мои бронирования"
                  onClick={() => navigate('/my-bookings')}
                />
              </div>
           </div>
        )}

      </div>
    </div>
  );
}