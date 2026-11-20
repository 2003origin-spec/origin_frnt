/** The Google Play mark (four colours), for the "Get it on Google Play" badge. Decorative: the
 *  button around it carries the label. */
export default function GooglePlayLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M3.6 1.8c-.37.2-.6.6-.6 1.1v18.2c0 .5.23.9.6 1.1L13.9 12 3.6 1.8z" />
      <path fill="#34A853" d="M16.9 8.9 5.7 2.4C5 2 4.2 1.9 3.6 1.8L13.9 12l3-3.1z" />
      <path fill="#EA4335" d="M3.6 22.2c.6-.1 1.4-.2 2.1-.6l11.2-6.5-3-3.1L3.6 22.2z" />
      <path fill="#FBBC04" d="m20.3 10.8-3.4-1.9-3 3.1 3 3.1 3.4-2c.9-.5.9-1.8 0-2.3z" />
    </svg>
  );
}
