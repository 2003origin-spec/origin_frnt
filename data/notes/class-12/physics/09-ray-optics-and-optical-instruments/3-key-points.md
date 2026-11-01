---
title: "Ray Optics: Important Points and Traps"
type: key_points
chapter: c12.physics.ray-optics-and-optical-instruments
order: 3
---

## Sign convention

:::trap
Put the signs in **once**, when you substitute numbers. Write the formula as it is ($\frac1v + \frac1u = \frac1f$), then put $u = -20$ cm, $f = -15$ cm. Do not change the formula **and** the numbers, or you count the sign twice.
:::

- For a real object with light from the left, $u$ is **always negative**, for mirrors and lenses.
- Concave mirror: $f < 0$. Convex mirror: $f > 0$. Convex lens: $f > 0$. Concave lens: $f < 0$.
- A positive $v$ means: for a **mirror**, the image is behind it (virtual); for a **lens**, the image is on the far side (real).

:::trap
The two magnification formulas differ by a sign:
- mirror: $m = -\dfrac{v}{u}$;
- lens: $m = +\dfrac{v}{u}$.

In both, $m < 0$ means real and inverted, $m > 0$ means virtual and erect.
:::

:::trap
Mirror equation has a **plus** ($\frac1v + \frac1u$); lens formula has a **minus** ($\frac1v - \frac1u$). Mixing them up is the most common mistake in this chapter.
:::

## Mirrors

- $f = R/2$ only for **paraxial** rays. Wide rays from a big spherical mirror do not meet at one point.
- A convex mirror always gives a virtual, erect, **smaller** image between P and F, wherever the real object is.
- A concave mirror gives a virtual, erect, **bigger** image only when the object is between P and F (shaving and make-up mirrors).
- Covering half the mirror or lens: the **full** image still forms, only dimmer.
- (Exam extra, used in NCERT Exercise 9.30) Turning a plane mirror by $\theta$ turns the reflected ray by $2\theta$.

:::remember
As an object comes closer to a convex side mirror at steady speed, its image moves **faster and faster** (NCERT Example 9.4).
:::

## Refraction and TIR

- Refractive index depends on the **pair of media** and on the **wavelength**, not on the angle of incidence.
- A medium can be optically denser yet lighter in mass density (turpentine vs water).
- (From NCERT Chapter 10) On refraction the **frequency** stays the same; speed and wavelength change.
- A glass slab gives **no deviation**, only a lateral shift.

:::trap
Apparent depth $= \dfrac{\text{real depth}}{n}$ is only for viewing **nearly along the normal**, with the object in the denser medium and the eye in air. A glass slab of thickness $t$ placed over an object raises its image by $t\left(1 - \dfrac1n\right)$, wherever the slab sits between the object and the eye (NCERT Exercise 9.16).
:::

:::trap
TIR needs **both** conditions: light going from **denser to rarer**, and $i > i_c$. Going from air into glass there is no TIR at any angle.
:::

- Bigger $n$ means smaller $i_c$: diamond (2.42) has $i_c \approx 24.4^\circ$, so light gets trapped and it sparkles.
- In an optical fibre the **core** has the **higher** refractive index, the cladding the lower.
- Light from a point source at depth $h$ in a liquid leaves the surface through a circle of radius $h\tan i_c$ (NCERT Exercise 9.5 type).

## Lenses

:::trap
Lens maker's formula uses $n_{21} = \dfrac{n_{lens}}{n_{medium}}$, not $n_{lens}$ alone. In water ($n = 1.33$) a glass lens ($n = 1.5$) has its focal length about **4 times** longer. If $n_{lens} < n_{medium}$, a convex lens **diverges**.
:::

- If $n_{lens} = n_{medium}$, the lens has no power and becomes invisible.
- $R_1$, $R_2$ are taken in the order the light meets the surfaces, with signs. Equiconvex: $R_1 = +R$, $R_2 = -R$, giving $\dfrac1f = \dfrac{2(n - 1)}{R}$.
- A plano-convex lens: $R_2 = \infty$, so $\dfrac1f = \dfrac{n - 1}{R}$. For $n = 1.5$, $f = 2R$.
- Cutting a lens **along** its axis into two halves: each half has the **same** $f$. Cutting an **equiconvex** lens **across** into two plano-convex lenses: each has $f$ **doubled** (exam extra).

:::trap
Power in dioptre needs $f$ in **metres**. $f = 20$ cm gives $P = +5$ D, not $+0.05$ D. Powers add only for **thin lenses in contact**.
:::

- The least distance between an object and its **real** image by a convex lens is $4f$ (object at $2f$). So to throw an image on a wall 3 m away, $f \le 75$ cm (NCERT Exercise 9.18 idea).

## Prism

- $\delta = i + e - A$ and $r_1 + r_2 = A$ hold for **every** ray through the prism.
- Minimum deviation: $i = e$, $r_1 = r_2 = A/2$, ray inside parallel to the base.
- Each deviation (other than $D_m$) is given by **two** angles of incidence, $i$ and $e$ swapped.
- $D_m = (n - 1)A$ only for a **thin** prism.
- In a liquid, use $n_{21} = n_{glass}/n_{liquid}$: the minimum deviation gets **smaller** (NCERT Exercise 9.6 type).
- (Exam extra: not in NCERT; prism refraction is in both syllabi) If $A > 2i_c$, no ray can come out of the second face, whatever the angle of incidence (from air).

## Optical instruments

:::trap
In the compound microscope, $L$ (tube length) is the distance between the **second focal point of the objective** and the **first focal point of the eyepiece**. It is not the distance between the lenses. In the telescope, the lens separation in normal adjustment is $f_o + f_e$.
:::

- Simple microscope: $m = 1 + D/f$ (image at 25 cm) is **one more** than $D/f$ (image at infinity).
- Microscope: **both** lenses of short focal length. Telescope: objective of **long** focal length and **large** aperture, eyepiece short.
- Normal adjustment means the final image is at **infinity** (relaxed eye).
- NCERT takes the telescope's $m = f_o/f_e$ as a positive number (ratio of angles). Some books write $-f_o/f_e$ to show the inverted image. Same size. NCERT also quotes the compound microscope's $m = m_o m_e$ as positive.
- The final image in an astronomical telescope and in a compound microscope is **inverted**.

:::tip
**Microscope: Short, Short. Telescope: Long, Short.** Telescope magnifying power is "long over short", $f_o/f_e$, and the tube is "long plus short", $f_o + f_e$.
:::

## NCERT facts to know

:::remember
- Visible light: about 400 nm to 750 nm.
- Prisms that bend light by 90° or 180° need $i_c < 45^\circ$; crown and flint glass qualify.
- Largest lens objective: 40 inch (about 1.02 m), Yerkes Observatory, USA.
- Mt. Palomar: 200 inch (about 5.08 m) reflector; the observer sits in a cage near the focus.
- Largest telescope in India: 2.34 m Cassegrain reflector at **Kavalur**, Tamil Nadu (Indian Institute of Astrophysics).
- Largest reflectors: the two **Keck** telescopes, Hawaii, 10 m.
- A mirror has **no chromatic aberration**.
:::

:::remember
The current NCERT chapter no longer covers the human eye, the dispersion section (dispersive power), the rainbow or scattering of light. The JEE Main and NEET 2026 syllabi don't list them either.
:::
