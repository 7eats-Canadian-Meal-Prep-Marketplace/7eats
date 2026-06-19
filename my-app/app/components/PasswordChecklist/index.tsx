"use client";

import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password";
import styles from "./PasswordChecklist.module.css";

/**
 * Live password-requirements list. Each rule turns green once met. Rules stay
 * neutral until the user starts typing so an empty field doesn't look "wrong".
 */
export default function PasswordChecklist({ password }: { password: string }) {
  const touched = password.length > 0;
  return (
    <ul className={styles.list} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`${styles.item} ${met ? styles.met : touched ? styles.unmet : ""}`}
          >
            <span className={styles.icon} aria-hidden="true">
              {met ? <Check size={13} /> : <X size={13} />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
