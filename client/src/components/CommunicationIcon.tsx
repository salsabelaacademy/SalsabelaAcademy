/** Unmodified Bootstrap Icons paths (MIT), from the official icon pages.
 * License and source links: client/public/icons/BOOTSTRAP-LICENSE.txt.
 */
export function CommunicationIcon({ filled = false, size = 24 }: { filled?: boolean; size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="communication-icon">
    <path d={filled
      ? "M2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"
      : "M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"} />
  </svg>;
}
