import Image from "next/image";

// O boné do Pablo tem hélice: ela gira em cima do avatar em todas as telas.
export default function BrandAvatar() {
  return <span className="brand-avatar-wrap" aria-hidden="true">
    <span className="brand-propeller"><i /></span>
    <span className="brand-avatar"><Image src="/mascote.png" fill sizes="40px" alt="" /></span>
  </span>;
}
