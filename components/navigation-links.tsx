import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { navigationUrls } from "@/lib/delivery-links";

export default function NavigationLinks({ destination, dark = false, label = "Como chegar" }: { destination: string; dark?: boolean; label?: string }) {
  const urls = navigationUrls(destination);
  return <div className={`route-picker${dark ? " route-picker-dark" : ""}`}>
    <p className="route-picker-label">{label}<span>Escolha o app para abrir a rota</span></p>
    <div className="route-picker-options">
      <a className="route-option route-option-maps" href={urls.maps} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><Image className="route-logo" src="/navigation/google-maps.png" width={28} height={28} alt="" aria-hidden="true" /><span>Google Maps</span><ArrowUpRight size={15} aria-hidden="true" /></a>
      <a className="route-option route-option-waze" href={urls.waze} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><Image className="route-logo route-logo-waze" src="/navigation/waze.png" width={28} height={28} alt="" aria-hidden="true" /><span>Waze</span><ArrowUpRight size={15} aria-hidden="true" /></a>
    </div>
  </div>;
}
