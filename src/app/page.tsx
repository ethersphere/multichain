import FetchPriceComponent from "@/components/Calculator/AmountAndDepthCalc";
import { Widget } from "@/components/Widget";
import { WidgetEvents } from "@/components/WidgetEvents";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-black">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col">
        <FetchPriceComponent />
        <br />
        <WidgetEvents />
        <Widget />
        {/* <UploadCostCalc /> */}
      </div>
    </main>
  );
}
