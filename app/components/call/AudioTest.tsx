"use client";

import { useState, useRef, useEffect } from "react";
import { HiMicrophone, HiSpeakerWave } from "react-icons/hi2";
import { BsMicMuteFill } from "react-icons/bs";

interface AudioTestProps {
  isOpen: boolean;
  onClose: () => void;
}

const AudioTest: React.FC<AudioTestProps> = ({ isOpen, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoopback, setIsLoopback] = useState(false);
  
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Start microphone test
  const startTest = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Create audio context for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsTesting(true);

      // Start visualization
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

    } catch (err: any) {
      console.error("Microphone test error:", err);
      if (err.name === "NotAllowedError") {
        setError("Vui lòng cho phép truy cập microphone");
      } else if (err.name === "NotFoundError") {
        setError("Không tìm thấy microphone");
      } else {
        setError("Không thể truy cập microphone: " + err.message);
      }
    }
  };

  // Stop test
  const stopTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsTesting(false);
    setAudioLevel(0);
    setIsLoopback(false);
  };

  // Toggle loopback (hear yourself)
  const toggleLoopback = () => {
    if (!streamRef.current || !audioRef.current) return;
    
    if (isLoopback) {
      audioRef.current.srcObject = null;
      setIsLoopback(false);
    } else {
      audioRef.current.srcObject = streamRef.current;
      audioRef.current.play().catch(console.error);
      setIsLoopback(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-xl font-semibold mb-4">Kiểm tra âm thanh</h2>
        
        {/* Hidden audio element for loopback */}
        <audio ref={audioRef} className="hidden" />

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Microphone Test */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Microphone</h3>
          
          {isTesting ? (
            <div className="space-y-3">
              {/* Audio level indicator */}
              <div className="flex items-center gap-3">
                <HiMicrophone className="w-6 h-6 text-green-500" />
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-75"
                    style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-12">
                  {Math.round(audioLevel)}%
                </span>
              </div>
              
              <p className="text-sm text-gray-500">
                {audioLevel > 10 
                  ? "✅ Microphone đang hoạt động! Nói gì đó để kiểm tra."
                  : "🎤 Hãy nói gì đó để kiểm tra microphone..."}
              </p>

              {/* Loopback toggle */}
              <button
                onClick={toggleLoopback}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                  isLoopback 
                    ? "bg-sky-500 text-white" 
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <HiSpeakerWave className="w-4 h-4" />
                {isLoopback ? "Đang nghe (click để tắt)" : "Nghe thử giọng nói"}
              </button>

              {isLoopback && (
                <p className="text-xs text-amber-600">
                  ⚠️ Đeo tai nghe để tránh tiếng vọng
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={startTest}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
            >
              <HiMicrophone className="w-5 h-5" />
              Bắt đầu kiểm tra
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Hướng dẫn:</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Click "Bắt đầu kiểm tra" và cho phép truy cập microphone</li>
            <li>Nói gì đó - thanh màu xanh sẽ di chuyển nếu mic hoạt động</li>
            <li>Click "Nghe thử giọng nói" để kiểm tra speaker (đeo tai nghe)</li>
            <li>Nếu nghe được giọng mình → âm thanh hoạt động tốt!</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isTesting && (
            <button
              onClick={stopTest}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Dừng kiểm tra
            </button>
          )}
          <button
            onClick={() => {
              stopTest();
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioTest;
