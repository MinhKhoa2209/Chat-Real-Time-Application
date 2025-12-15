"use client";

import { useState, useRef, useEffect } from "react";
import { HiMicrophone, HiSpeakerWave, HiArrowLeft } from "react-icons/hi2";
import Link from "next/link";

export default function TestAudioPage() {
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoopback, setIsLoopback] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Get available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      setDevices(deviceList.filter(d => d.kind === "audioinput" || d.kind === "audiooutput"));
    });
  }, []);

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

      // Refresh device list
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList.filter(d => d.kind === "audioinput" || d.kind === "audiooutput"));

    } catch (err: any) {
      console.error("Microphone test error:", err);
      if (err.name === "NotAllowedError") {
        setError("Vui lòng cho phép truy cập microphone trong browser settings");
      } else if (err.name === "NotFoundError") {
        setError("Không tìm thấy microphone. Hãy kết nối microphone và thử lại.");
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
    if (audioRef.current) {
      audioRef.current.srcObject = null;
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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/conversations" 
            className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-4"
          >
            <HiArrowLeft className="w-5 h-5" />
            Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Kiểm tra âm thanh</h1>
          <p className="text-gray-600">Kiểm tra microphone và speaker trước khi gọi</p>
        </div>

        {/* Hidden audio element for loopback */}
        <audio ref={audioRef} className="hidden" />

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Microphone Test Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HiMicrophone className="w-6 h-6 text-sky-500" />
            Kiểm tra Microphone
          </h2>
          
          {isTesting ? (
            <div className="space-y-4">
              {/* Audio level indicator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-75 ${
                      audioLevel > 30 ? "bg-green-500" : audioLevel > 10 ? "bg-yellow-500" : "bg-gray-400"
                    }`}
                    style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-gray-500 w-16">
                  {Math.round(audioLevel)}%
                </span>
              </div>
              
              <div className={`p-3 rounded-lg ${audioLevel > 10 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {audioLevel > 30 
                  ? "✅ Tuyệt vời! Microphone hoạt động tốt."
                  : audioLevel > 10 
                    ? "✅ Microphone đang hoạt động. Hãy nói to hơn để kiểm tra."
                    : "🎤 Hãy nói gì đó để kiểm tra microphone..."}
              </div>

              {/* Loopback toggle */}
              <div className="flex gap-3">
                <button
                  onClick={toggleLoopback}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
                    isLoopback 
                      ? "bg-sky-500 text-white" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <HiSpeakerWave className="w-5 h-5" />
                  {isLoopback ? "🔊 Đang phát - Click để tắt" : "Nghe thử giọng nói"}
                </button>
                
                <button
                  onClick={stopTest}
                  className="px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                >
                  Dừng
                </button>
              </div>

              {isLoopback && (
                <div className="p-3 bg-amber-100 text-amber-700 rounded-lg text-sm">
                  ⚠️ Đeo tai nghe để tránh tiếng vọng. Nếu nghe được giọng mình → speaker hoạt động tốt!
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={startTest}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
            >
              <HiMicrophone className="w-5 h-5" />
              Bắt đầu kiểm tra
            </button>
          )}
        </div>

        {/* Device List */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Thiết bị âm thanh</h2>
          
          {devices.length > 0 ? (
            <div className="space-y-2">
              {devices.filter(d => d.kind === "audioinput").length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Microphone:</h3>
                  {devices.filter(d => d.kind === "audioinput").map((device, i) => (
                    <div key={device.deviceId || i} className="p-2 bg-gray-50 rounded text-sm">
                      🎤 {device.label || `Microphone ${i + 1}`}
                    </div>
                  ))}
                </div>
              )}
              
              {devices.filter(d => d.kind === "audiooutput").length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Speaker:</h3>
                  {devices.filter(d => d.kind === "audiooutput").map((device, i) => (
                    <div key={device.deviceId || i} className="p-2 bg-gray-50 rounded text-sm">
                      🔊 {device.label || `Speaker ${i + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Click "Bắt đầu kiểm tra" để xem danh sách thiết bị
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Hướng dẫn khắc phục</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="p-3 bg-gray-50 rounded-lg">
              <strong>Không nghe được âm thanh trong cuộc gọi?</strong>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Kiểm tra volume của máy tính/điện thoại</li>
                <li>Đảm bảo speaker đúng được chọn trong system settings</li>
                <li>Thử dùng tai nghe</li>
                <li>Refresh trang và thử lại</li>
              </ul>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <strong>Người khác không nghe được bạn?</strong>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Kiểm tra microphone có được kết nối không</li>
                <li>Cho phép browser truy cập microphone</li>
                <li>Kiểm tra thanh level ở trên có di chuyển khi nói không</li>
                <li>Thử chọn microphone khác trong system settings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
