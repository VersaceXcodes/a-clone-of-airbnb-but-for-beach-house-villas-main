import React from 'react';
import { Link } from 'react-router-dom';

const UV_404NotFound: React.FC = () => {
  const message = 'Page not found. The page you requested does not exist.';
  const illustration_url = 'https://picsum.photos/600/400?grayscale&blur=2';

  return (
    <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center py-12 px-4 bg-white">
      <img
        src={illustration_url}
        alt="404 Not Found Illustration"
        className="w-full max-w-md h-64 object-cover rounded-xl shadow-lg mb-8 border border-gray-200"
        style={{ backgroundColor: '#f3f4f6' }}
        draggable={false}
      />
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3 drop-shadow-sm text-center">
        404 Not Found
      </h1>
      <p className="text-gray-600 text-lg md:text-xl mb-8 text-center max-w-xl">
        {message}
      </p>
      <Link
        to="/"
        className="inline-block px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 text-white font-bold text-base md:text-lg shadow transition-colors duration-150 outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Return to homepage"
      >
        Return to Homepage
      </Link>
      <div className="mt-8 text-sm text-gray-400 text-center max-w-xs">
        If you think this is an error, please check the URL or head back to the homepage.
      </div>
    </div>
  );
};

export default UV_404NotFound;