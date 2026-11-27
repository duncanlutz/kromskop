import styles from "./StubView.module.css";

/** Stands in for a view that a later round of the UI pass will build. */
export function StubView({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className={styles.stub}>
      <div>
        <h1 className={styles.heading}>{name}</h1>
        <p className={styles.purpose}>{purpose}</p>
        <p className={styles.note}>Not built yet. This round covers Develop.</p>
      </div>
    </div>
  );
}
