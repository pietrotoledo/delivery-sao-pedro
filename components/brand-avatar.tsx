import Image from "next/image";

export default function BrandAvatar() {
  return <span className="brand-avatar" aria-hidden="true"><Image src="/mascote.png" fill sizes="40px" alt="" /></span>;
}
