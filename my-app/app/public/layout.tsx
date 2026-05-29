import BackToTop from "@/app/components/BackToTop";
import BannerFlash from "@/app/components/BannerFlash";
import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BannerFlash />
      <Header />
      {children}
      <Footer />
      <BackToTop />
    </>
  );
}
