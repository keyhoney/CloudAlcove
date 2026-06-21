import { queryCameraPermission } from '../lib/media'

interface CameraGateProps {
  error: string | null
  requesting: boolean
  onStart: () => void
}

export default function CameraGate({ error, requesting, onStart }: CameraGateProps) {
  const handleHelp = () => {
    void queryCameraPermission().then((state) => {
      if (state === 'denied') {
        alert(
          'Chrome 카메라 허용 방법:\n\n' +
            '1. 주소창 왼쪽 🔒 클릭\n' +
            '2. 「카메라」→ 「허용」\n' +
            '3. 페이지 새로고침 (F5)\n\n' +
            '또는 chrome://settings/content/camera 에서 localhost 허용',
        )
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-8 text-center ring-1 ring-slate-700">
        <div className="mb-4 text-5xl">📷</div>
        <h2 className="mb-2 text-xl font-semibold text-white">카메라를 켜 주세요</h2>
        <p className="mb-6 text-sm text-slate-400">
          Chrome에서 버튼을 누르면 권한 요청 팝업이 뜹니다.
          <br />
          「허용」을 선택해 주세요.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={requesting}
          className="mb-3 w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {requesting ? '연결 중...' : '카메라 켜고 시작'}
        </button>

        <button
          type="button"
          onClick={handleHelp}
          className="text-xs text-slate-500 underline hover:text-slate-300"
        >
          권한 허용했는데도 안 되나요?
        </button>
      </div>
    </div>
  )
}
