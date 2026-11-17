import { useEffect, useState } from 'react';
import { mediaUrl } from '../../services/http';
import { useToast } from './Toast';

/** Opens a protected /media/ file in a new tab (downloaded with the login token first). */
export function MediaLink({ url, children = 'View', className = 'btn btn-secondary btn-sm' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    // Open the tab now (inside the click) so the browser doesn't block it as a pop-up.
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const blob = await mediaUrl(url);
      if (tab) tab.location.href = blob; else window.location.href = blob;
    } catch (err) {
      tab?.close();
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" className={className} onClick={open} disabled={busy || !url}>{busy ? 'Opening…' : children}</button>;
}

/** <img> for a protected /media/ file. */
export function MediaImg({ src, alt = '', ...props }) {
  const [blob, setBlob] = useState(null);
  useEffect(() => {
    let url = null;
    let off = false;
    mediaUrl(src).then((u) => { url = u; if (!off) setBlob(u); }).catch(() => {});
    return () => { off = true; if (url) URL.revokeObjectURL(url); };
  }, [src]);
  return blob ? <img src={blob} alt={alt} {...props} /> : <span className={props.className} aria-hidden="true" />;
}
