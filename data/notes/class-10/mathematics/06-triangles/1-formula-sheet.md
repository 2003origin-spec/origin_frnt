---
title: "Triangles: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.triangles
order: 1
---

## Similar figures

:::formula{title="Similar polygons"}
Two polygons with the **same number of sides** are similar when **both** hold:

1. their corresponding angles are equal, and
2. their corresponding sides are in the same ratio.

The common ratio of the sides is the **scale factor** (or Representative Fraction).
:::

:::formula{title="Similar triangles"}
$$\triangle ABC \sim \triangle DEF$$
means $\angle A = \angle D$, $\angle B = \angle E$, $\angle C = \angle F$ and
$$\frac{AB}{DE} = \frac{BC}{EF} = \frac{CA}{FD}$$
The order of the letters shows which vertex matches which: $A \leftrightarrow D$, $B \leftrightarrow E$, $C \leftrightarrow F$.
:::

## Basic Proportionality Theorem (Thales)

In $\triangle ABC$, D is on AB and E is on AC.

:::formula{title="BPT (Theorem 6.1)"}
If $DE \parallel BC$, then
$$\frac{AD}{DB} = \frac{AE}{EC}$$
The line must cut the other two sides at **distinct points**.
:::

:::formula{title="Other forms of BPT"}
If $DE \parallel BC$, then also
$$\frac{AD}{AB} = \frac{AE}{AC}$$
$$\frac{DB}{AB} = \frac{EC}{AC}$$
The first is Example 1 of the book. The second follows from it.
:::

:::formula{title="Converse of BPT (Theorem 6.2)"}
If
$$\frac{AD}{DB} = \frac{AE}{EC}$$
then $DE \parallel BC$.
:::

:::formula{title="The parallel segment itself"}
If $DE \parallel BC$, then $\triangle ADE \sim \triangle ABC$ (AA), so
$$\frac{DE}{BC} = \frac{AD}{AB}$$
Use $AD/AB$ here, **not** $AD/DB$.
:::

## Criteria for similarity of triangles

:::formula{title="AAA / AA criterion (Theorem 6.3)"}
If $\angle A = \angle D$ and $\angle B = \angle E$, then $\triangle ABC \sim \triangle DEF$.

Two equal angles are enough. The third angles then match by the angle sum property.
:::

:::formula{title="SSS criterion (Theorem 6.4)"}
If
$$\frac{AB}{DE} = \frac{BC}{EF} = \frac{CA}{FD}$$
then $\triangle ABC \sim \triangle DEF$.
:::

:::formula{title="SAS criterion (Theorem 6.5)"}
If $\angle A = \angle D$ and
$$\frac{AB}{DE} = \frac{AC}{DF}$$
then $\triangle ABC \sim \triangle DEF$. The equal angle must be **between** the two proportional sides.
:::

:::formula{title="RHS criterion (Note to the reader)"}
In two right triangles, if the hypotenuse and one side of one are proportional to the hypotenuse and one side of the other, the triangles are similar.
:::

## Standard results from the book

:::formula{title="Trapezium: diagonals"}
ABCD with $AB \parallel DC$, diagonals meeting at O:
$$\frac{AO}{OC} = \frac{BO}{OD} = \frac{AB}{CD}$$
Because $\triangle AOB \sim \triangle COD$ (AA).
:::

:::formula{title="Trapezium: a line parallel to the bases"}
E on AD, F on BC, $EF \parallel AB \parallel DC$:
$$\frac{AE}{ED} = \frac{BF}{FC}$$
:::

:::formula{title="Medians and angle bisectors"}
If $\triangle ABC \sim \triangle PQR$ and AD, PM are corresponding medians (or corresponding angle bisectors), then
$$\frac{AD}{PM} = \frac{AB}{PQ}$$
:::

:::formula{title="Angle at a point on a side"}
D on BC with $\angle ADC = \angle BAC$. Then $\triangle ADC \sim \triangle BAC$, so
$$CA^2 = CB \cdot CD$$
:::

:::formula{title="Shadows at the same time"}
Vertical objects on level ground, at the same moment, make similar right triangles with their shadows:
$$\frac{h_1}{s_1} = \frac{h_2}{s_2}$$
$h_1, h_2$ = heights of the two objects, $s_1, s_2$ = their shadows. Use the **same unit** for all lengths.
:::
