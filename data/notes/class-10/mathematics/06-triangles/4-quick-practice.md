---
title: "Triangles: Quick Practice"
type: practice
chapter: c10.mathematics.triangles
order: 4
---

Try each question first, then tap **Show answer**. All lengths are in cm unless the question says otherwise.

## Similar figures

:::question{title="1. Square and rhombus" exam="Board level"}
A square has side 4 cm. A rhombus has side 6 cm and one angle of 60°. Are they similar? Give a reason.

---

All side ratios are $\frac46 = \frac23$, so the sides are proportional. But the square's angles are all 90°, while the rhombus has a 60° angle. The angles are not equal.

**No, they are not similar.** For polygons, both conditions are needed.
:::

## BPT and its converse

:::question{title="2. Find a part" exam="Board level"}
In $\triangle ABC$, $DE \parallel BC$ with D on AB and E on AC. AD = 3, DB = 4.5 and AE = 2.4. Find EC.

---

By BPT, $\dfrac{AD}{DB} = \dfrac{AE}{EC}$, so $\dfrac{3}{4.5} = \dfrac{2.4}{EC}$.

$EC = \dfrac{2.4 \times 4.5}{3} =$ **3.6 cm**.
:::

:::question{title="3. The parallel segment" exam="Board level"}
In $\triangle ABC$, $DE \parallel BC$ with D on AB and E on AC. AD = 4, AB = 10, AC = 15 and BC = 12. Find AE and DE.

---

$\dfrac{AE}{AC} = \dfrac{AD}{AB}$, so $AE = 15 \times \dfrac{4}{10} = 6$.

$\triangle ADE \sim \triangle ABC$ (AA), so $\dfrac{DE}{BC} = \dfrac{AD}{AB}$ and $DE = 12 \times \dfrac{4}{10} = 4.8$.

**AE = 6 cm, DE = 4.8 cm.** (Not $\frac{AD}{DB}$ for DE.)
:::

:::question{title="4. Find x" exam="Board level"}
In $\triangle ABC$, D is on AB and E is on AC. AD = $x + 1$, DB = $3x - 1$, AE = $x + 3$ and EC = $3x + 4$. Find $x$ so that $DE \parallel BC$.

---

By the converse of BPT we need $\dfrac{x + 1}{3x - 1} = \dfrac{x + 3}{3x + 4}$.

Cross-multiply: $3x^2 + 7x + 4 = 3x^2 + 8x - 3$, so $x = 7$.

Check: AD = 8, DB = 20, AE = 10, EC = 25. Both ratios are $\frac25$. So **$x = 7$**.
:::

## Criteria for similarity

:::question{title="5. Matching vertices" exam="Board level"}
In $\triangle ABC$: AB = 4, BC = 6, CA = 8. In $\triangle PQR$: PQ = 9, QR = 12, RP = 6. Are the triangles similar? Which angle of $\triangle PQR$ equals $\angle C$?

---

Match shortest to shortest: $\dfrac{AB}{RP} = \dfrac46$, $\dfrac{BC}{PQ} = \dfrac69$, $\dfrac{CA}{QR} = \dfrac{8}{12}$. All are $\frac23$.

So $\triangle ABC \sim \triangle RPQ$ (SSS), with $A \leftrightarrow R$, $B \leftrightarrow P$, $C \leftrightarrow Q$.

**Yes, similar; $\angle C = \angle Q$.**
:::

:::question{title="6. Crossing segments" exam="Board level"}
Segments AC and BD cross at O. OA = 6, OC = 9, OB = 4 and OD = 6. AB = 5. Find CD, and say whether $AB \parallel CD$.

---

$\dfrac{OA}{OC} = \dfrac69 = \dfrac23$ and $\dfrac{OB}{OD} = \dfrac46 = \dfrac23$. Also $\angle AOB = \angle COD$ (vertically opposite).

So $\triangle AOB \sim \triangle COD$ (SAS) and $CD = AB \times \dfrac{3}{2} = 7.5$.

Then $\angle OAB = \angle OCD$. These are alternate angles, so $AB \parallel CD$.

**CD = 7.5 cm, and yes, $AB \parallel CD$.**
:::

:::question{title="7. A product of sides" exam="Board level"}
D is a point on side BC of $\triangle ABC$ with $\angle ADC = \angle BAC$. CB = 16 and CD = 9. Find CA.

---

In $\triangle ADC$ and $\triangle BAC$: $\angle ADC = \angle BAC$ and $\angle C$ is common. So $\triangle ADC \sim \triangle BAC$ (AA).

$\dfrac{CA}{CB} = \dfrac{CD}{CA}$, so $CA^2 = 16 \times 9 = 144$.

**CA = 12 cm.**
:::

## Applications

:::question{title="8. Height of a tower" exam="Board level"}
At a certain time, a vertical pole 5 m tall casts a shadow 3.5 m long. At the same time, a tower casts a shadow 21 m long. Find the height of the tower.

---

The two right triangles are similar (AA). $\dfrac{h}{21} = \dfrac{5}{3.5}$, so $h = \dfrac{5 \times 21}{3.5} =$ **30 m**.
:::

:::question{title="9. Moving shadow" exam="Board level"}
A lamp is 4.8 m above the ground. A boy 1.6 m tall walks straight away from the base of the lamp-post at 1.5 m/s. Find the length of his shadow after 6 seconds.

---

Distance walked $= 1.5 \times 6 = 9$ m. Let the shadow be $x$ m.

The lamp-post triangle and the boy's triangle are similar (AA), so $\dfrac{9 + x}{x} = \dfrac{4.8}{1.6} = 3$.

$9 + x = 3x$, so $x =$ **4.5 m**.
:::

:::question{title="10. Trapezium diagonals" exam="Board level"}
ABCD is a trapezium with $AB \parallel DC$, AB = 15 and DC = 10. The diagonals meet at O. Diagonal AC = 20. Find AO and OC.

---

$\triangle AOB \sim \triangle COD$ (AA: alternate angles), so $\dfrac{AO}{OC} = \dfrac{AB}{CD} = \dfrac{15}{10} = \dfrac32$.

Split 20 in the ratio 3 : 2: $AO = 20 \times \dfrac35 = 12$ and $OC = 8$.

**AO = 12 cm, OC = 8 cm.**
:::
