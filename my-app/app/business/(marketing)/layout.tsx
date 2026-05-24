import BackToTop from "@/app/components/BackToTop";
import BusinessHeader from "@/app/components/BusinessHeader";
import Footer from "@/app/components/Footer";

export default function BusinessMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BusinessHeader />
      {children}
      <Footer />
      <BackToTop />
    </>
  );
}
