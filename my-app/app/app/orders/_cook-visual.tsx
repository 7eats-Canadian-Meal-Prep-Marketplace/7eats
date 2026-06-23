import Image from "next/image";
import styles from "./_cook-visual.module.css";

type CookVisualProps = {
  bannerUrl?: string | null;
  photoUrl?: string | null;
  initials?: string | null;
  dimmed?: boolean;
};

/** Thumbnail on order list rows: banner (or profile photo) with initials fallback. */
export function OrderCookCover({
  bannerUrl,
  photoUrl,
  initials,
  dimmed,
}: CookVisualProps) {
  const coverUrl = bannerUrl ?? photoUrl;

  return (
    <div
      className={`${styles.cover} ${dimmed ? styles.coverDimmed : ""}`}
      aria-hidden
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          className={styles.coverImg}
          sizes="72px"
        />
      ) : (
        <div className={styles.coverFallback}>
          <span className={styles.coverInitials}>{initials ?? "?"}</span>
        </div>
      )}
    </div>
  );
}

type OrderCookHeroProps = CookVisualProps & {
  cookName: string;
  title: string;
};

/** Header on order detail: banner + avatar like the cook menu card. */
export function OrderCookHero({
  bannerUrl,
  photoUrl,
  initials,
  cookName,
  title,
}: OrderCookHeroProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroBanner}>
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            className={styles.heroBannerImg}
            sizes="(max-width: 768px) 100vw, 640px"
          />
        ) : (
          <div className={styles.heroBannerFallback} />
        )}
      </div>
      <div className={styles.heroBody}>
        <div className={styles.heroAvatar}>
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={cookName}
              fill
              className={styles.heroAvatarImg}
              sizes="64px"
            />
          ) : (
            <span>{initials ?? "?"}</span>
          )}
        </div>
        <div className={styles.heroInfo}>
          <p className={styles.heroCook}>{title}</p>
          <h1 className={styles.heroTitle}>{cookName}</h1>
        </div>
      </div>
    </div>
  );
}
