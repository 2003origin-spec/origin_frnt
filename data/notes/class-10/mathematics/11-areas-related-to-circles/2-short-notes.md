---
title: "Areas Related to Circles: Short Notes"
type: short_notes
chapter: c10.mathematics.areas-related-to-circles
order: 2
---

## 1. What this chapter covers

- How to find the **area of a sector**, the **length of its arc**, and the **area of a segment** of a circle.
- You already know two facts from earlier classes: the circumference of a circle is $2\pi r$ and its area is $\pi r^2$. Everything here is a **part** of these two.
- The current NCERT book has only this one topic (sectors and segments). Older editions also had a review of circle perimeter and area, and areas of combined figures. Those sections are no longer in the book.

## 2. Sector

- A **sector** is the part of the circle enclosed by **two radii** and the **arc** between them. It looks like a slice of pizza.
- In sector $OAPB$ with centre $O$, $\angle AOB$ is the **angle of the sector**.
- The two radii cut the circle into two sectors:
  - the smaller one is the **minor sector** (angle $\theta$);
  - the bigger one is the **major sector** (angle $360^\circ - \theta$).

## 3. Segment

- A **segment** is the part of the circle enclosed by a **chord** and the **arc** on one side of it.
- A chord $AB$ cuts the circle into two segments: the smaller **minor segment** and the bigger **major segment**.

:::remember
When a question says just "sector" or "segment", it means the **minor** sector or the **minor** segment, unless it says otherwise (NCERT remark).
:::

| Region | Bounded by |
|---|---|
| Sector | two radii and an arc |
| Segment | a chord and an arc |

## 4. Area of a sector (unitary method)

NCERT treats the whole circle as a sector of angle $360^\circ$.

- Angle $360^\circ$ → area $\pi r^2$.
- Angle $1^\circ$ → area $\dfrac{\pi r^2}{360}$.
- Angle $\theta$ → area $\dfrac{\theta}{360} \times \pi r^2$.

So a sector is the fraction $\dfrac{\theta}{360}$ of the whole circle. For example, a $90^\circ$ sector (a **quadrant**) is $\dfrac14$ of the circle, and a $60^\circ$ sector is $\dfrac16$.

:::example{title="NCERT Example 1 type"}
Radius 4 cm, angle 30°, $\pi = 3.14$:

Sector $= \dfrac{30}{360} \times 3.14 \times 16 \approx 4.19$ cm².

Major sector $= 3.14 \times 16 - 4.19 \approx 46.1$ cm².
:::

## 5. Length of an arc

- The same unitary method on the circumference $2\pi r$ gives the arc length:
$$l = \frac{\theta}{360} \times 2\pi r$$
- The arc is a **length** (cm). The sector is an **area** (cm²).
- **Perimeter of a sector** = arc + two radii = $l + 2r$. (Not a formula in the book; just add the pieces.)

## 6. Area of a segment

$$\text{segment} = \text{sector} - \text{triangle } OAB$$

The triangle $OAB$ has $OA = OB = r$ (both radii), so it is **isosceles**. To find its area, NCERT draws $OM \perp AB$:

1. $\triangle AMO \cong \triangle BMO$ (RHS), so $M$ is the mid-point of $AB$.
2. $\angle AOM = \angle BOM = \dfrac{\theta}{2}$.
3. In right $\triangle OMA$: $OM = r\cos\dfrac{\theta}{2}$ and $AM = r\sin\dfrac{\theta}{2}$.
4. $AB = 2\,AM$, and area $= \dfrac12 \times AB \times OM$.

| $\theta$ | Triangle $OAB$ | Area |
|---|---|---|
| 60° | equilateral | $\sqrt{3}\,r^2/4$ |
| 90° | right-angled at $O$ | $r^2/2$ |
| 120° | $OM = r/2$ | $\sqrt{3}\,r^2/4$ |

:::example{title="NCERT Example 2 type"}
Radius 21 cm, $\angle AOB = 120^\circ$, $\pi = \dfrac{22}{7}$.

Sector $= \dfrac{120}{360} \times \dfrac{22}{7} \times 21 \times 21 = 462$ cm².

$OM = 21\cos 60^\circ = \dfrac{21}{2}$ cm and $AB = 2 \times 21\sin 60^\circ = 21\sqrt{3}$ cm.

Triangle $= \dfrac12 \times 21\sqrt{3} \times \dfrac{21}{2} = \dfrac{441\sqrt{3}}{4}$ cm².

Segment $= 462 - \dfrac{441\sqrt{3}}{4} = \dfrac{21}{4}\left(88 - 21\sqrt{3}\right)$ cm².
:::

## 7. Major sector and major segment

- Major sector $= \pi r^2 -$ minor sector. Or use the angle $360^\circ - \theta$ directly.
- Major segment $= \pi r^2 -$ minor segment.
- Check: the major segment is also the major sector **plus** the triangle $OAB$ (the triangle sits inside the major segment).

## 8. Sectors in real life

Most word problems hide a sector. Find $r$ and $\theta$ first.

| Situation | Radius | Angle |
|---|---|---|
| Minute hand, $t$ minutes | hand length | $6t^\circ$ |
| Animal tied at a square corner | rope | $90^\circ$ |
| $n$ equal ribs or designs | given | $360^\circ/n$ |
| Wiper or lighthouse beam | blade or range | given |

- **Grazing:** an animal tied at a corner of a square or rectangular field grazes a **quadrant**, as long as the rope is not longer than either side.
- **Wipers:** two wipers that do not overlap clean **twice** the area of one sector.
- **Brooch-type wire:** total wire = circumference + the diameters used inside.

## 9. Which value of π

- The NCERT exercise says: use $\pi = \dfrac{22}{7}$ unless the question says otherwise.
- Some questions say "use $\pi = 3.14$". Then use $3.14$, even if $r$ is a multiple of 7.
- If a question gives a value of $\sqrt{3}$, use it. NCERT uses $1.73$ in some questions and $1.7$ in one (the table cover, where $\pi$ is still $\dfrac{22}{7}$).
- If no value of $\pi$ is given, use $\dfrac{22}{7}$, whatever the radius.
