import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Travel Companion
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Your AI-powered travel planning assistant. Organize trips, track bookings,
          manage expenses, and collaborate with fellow travelers — all in one place.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="rounded-md bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold leading-6 text-gray-900 hover:text-primary-600"
          >
            Create Account <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
