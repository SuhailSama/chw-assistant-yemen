import { Component } from "react";

export default class ErrorBoundary extends Component {
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-surface flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-black text-on-surface mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-sm text-on-surface-variant mb-6">نعتذر عن هذا الخلل. يرجى إعادة تحميل الصفحة.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-white py-3 rounded-full font-bold active:scale-95 transition-transform"
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
