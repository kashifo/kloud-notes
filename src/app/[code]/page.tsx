import Home from '../page';

// This route reuses the unified Home component
// The Home component automatically detects the code from the URL path
// and loads the appropriate note
export default function NotePage() {
  return <Home />;
}
