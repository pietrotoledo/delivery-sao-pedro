import { verifyPayment } from "@/lib/payment";
import { json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const notice = await request.json() as {order_nsu?:string;transaction_nsu?:string;invoice_slug?:string;capture_method?:string};
    const verified = await verifyPayment(notice, new URL(request.url).origin);
    return json({success:verified,message:verified?null:"Pagamento não confirmado."},verified?200:400);
  } catch {
    return json({success:false,message:"Aviso inválido."},400);
  }
}
