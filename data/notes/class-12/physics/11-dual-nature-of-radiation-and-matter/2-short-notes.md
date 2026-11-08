---
title: "Dual Nature: Short Notes"
type: short_notes
chapter: c12.physics.dual-nature-of-radiation-and-matter
order: 2
---

## 1. Background: the electron

- **Cathode rays** (Crookes, 1870s): a glow appears in a discharge tube at very low pressure (about 0.001 mm of mercury). Crookes suggested the rays are fast **negatively charged** particles.
- **J. J. Thomson** used crossed electric and magnetic fields to measure their speed (0.1 to 0.2 times the speed of light) and specific charge. He named them **electrons** (1897).
- Specific charge $e/m = 1.76 \times 10^{11}$ C/kg. It is the same whatever the cathode metal or the gas, so electrons are universal parts of matter.
- **Millikan's oil-drop experiment** (1913): charge always comes in whole multiples of $e = 1.602 \times 10^{-19}$ C. Charge is **quantised**. From $e$ and $e/m$, the electron's mass follows.

## 2. Electron emission

Free electrons in a metal cannot normally leave it. If one tries, the surface becomes positive and pulls it back.

- **Work function** $\phi_0$: the **minimum** energy an electron needs to escape from the metal surface. It depends on the metal and on the **nature of its surface**. Usually given in eV.
- **1 eV** is the energy an electron gains when accelerated through 1 V: $1.602 \times 10^{-19}$ J.

Three ways to give electrons this energy:

| Process | How |
| --- | --- |
| Thermionic emission | Heating the metal |
| Field emission | A very strong electric field (about $10^8$ V/m), as in a spark plug |
| Photoelectric emission | Light of a suitable frequency |

## 3. Discovery of the photoelectric effect

- **Hertz (1887):** sparks across his detector loop got stronger when the emitter plate was lit with **ultraviolet** light.
- **Hallwachs (1888):** a negatively charged zinc plate on an electroscope **lost** its charge under UV. A neutral plate became **positive**, and a positive plate became **more** positive. So UV knocks out negative particles.
- **Lenard:** UV on the emitter plate of an evacuated tube made a current flow. It stopped the moment the UV was cut off.
- No electrons come out if the frequency is below a **threshold frequency**, which depends on the metal.
- Zinc, cadmium and magnesium respond only to UV. Alkali metals (Li, Na, K, Cs, Rb) respond even to **visible** light.

The emitted electrons are called **photoelectrons**.

## 4. The experiment

An evacuated glass tube with a **quartz window** (it lets UV through) holds a photosensitive plate C (emitter) and a metal plate A (collector). A battery and a commutator set A at any positive or negative potential relative to C. A voltmeter reads the potential; a microammeter reads the photocurrent. Coloured filters change the frequency; moving the source changes the intensity.

**(a) Intensity (frequency above threshold, frequency and potential fixed).** Photocurrent is **directly proportional** to intensity. So the number of photoelectrons per second is proportional to intensity.

**(b) Collector potential (frequency and intensity fixed).**
- Raising the positive (accelerating) potential raises the current until **all** emitted electrons are collected. The current then stops rising: the **saturation current**.
- Making A negative (retarding) repels the electrons. Only the faster ones get through, and the current falls to **zero** at a sharp value $V_0$, the **stopping (cut-off) potential**. Then $K_{max} = eV_0$.
- With higher intensity, the saturation current is **higher** but $V_0$ is the **same**.

**(c) Frequency (intensity fixed).** Higher frequency gives a larger stopping potential (the curves in NCERT Fig. 11.4 share one saturation current). A graph of $V_0$ against $\nu$ is a **straight line** for each metal, and $V_0 = 0$ at the threshold frequency $\nu_0$.

:::remember
**The four results (NCERT summary)**
1. Above threshold, photocurrent is proportional to intensity.
2. Saturation current is proportional to intensity; stopping potential does not depend on intensity.
3. Below the threshold frequency $\nu_0$ there is **no** emission, however intense the light. Above it, $K_{max}$ (and $V_0$) rises **linearly** with frequency.
4. Emission is **instantaneous** (within about $10^{-9}$ s), even for very dim light.
:::

Different materials respond differently: selenium is more sensitive than zinc or copper. UV gives the effect in copper; green or red light does not.

## 5. Why the wave theory fails

In the wave picture, energy spreads continuously over the wavefront, and a more intense wave has bigger electric and magnetic fields.

| Observation | Wave theory predicts |
| --- | --- |
| $K_{max}$ independent of intensity | $K_{max}$ grows with intensity |
| Threshold frequency exists | Any frequency works if intense enough |
| No time lag | Hours of delay for dim light |

The stopping-potential results (independent of intensity, dependent on frequency) are the key test between the two pictures.

## 6. Einstein's photoelectric equation (1905)

Light energy comes in discrete packets, **quanta**, each of energy $h\nu$. One electron absorbs **one** whole quantum:
$$K_{max} = h\nu - \phi_0$$

How it explains each result:
- $K_{max}$ depends linearly on $\nu$, and not on intensity, because one photon acts on one electron.
- $K_{max} \ge 0$ needs $h\nu \ge \phi_0$, so there is a threshold $\nu_0 = \phi_0/h$. A larger work function means a higher threshold.
- For light of a given frequency, intensity is **proportional to** the number of quanta per unit area per unit time. More quanta, more electrons, more current.
- Absorbing one quantum is an instantaneous process, so there is no delay at any intensity.

From $eV_0 = h\nu - \phi_0$, the $V_0$–$\nu$ graph has slope $h/e$ for **every** metal. **Millikan** (1906–1916) set out to disprove Einstein. He measured this slope for sodium, found $h$ close to $6.626 \times 10^{-34}$ J s, and so **confirmed** the equation.

## 7. The photon

Light carrying a definite energy $h\nu$ **and** momentum $h\nu/c$ behaves like a particle. This particle was named the **photon**. Compton's X-ray scattering experiment confirmed it.

- In its interaction with matter, radiation behaves as if made of photons.
- Each photon has energy $E = h\nu$, momentum $p = h\nu/c = h/\lambda$, and speed $c$.
- All photons of one frequency have the same energy and momentum, whatever the intensity. More intensity = more photons per second, not bigger photons.
- Photons are **electrically neutral**: electric and magnetic fields do not deflect them.
- In a photon–particle collision, total energy and total momentum are conserved, but the **number of photons need not be**. Photons can be absorbed or created.

## 8. Dual nature of radiation

- **Wave nature:** interference, diffraction, polarisation.
- **Particle nature:** photoelectric effect, Compton effect (energy and momentum transfer).
- Which picture fits depends on the experiment. In seeing, the eye lens focuses light as a **wave**, but the rods and cones of the retina absorb it as **photons**.

## 9. Wave nature of matter

**de Broglie (1924):** nature is symmetric, so if radiation has a dual nature, moving particles of matter should also show wave properties.
$$\lambda = \frac{h}{p} = \frac{h}{mv}$$

- $\lambda$ is a wave idea, $p$ a particle idea, and $h$ links them.
- The same relation gives a photon's wavelength: $p = h\nu/c$, so $h/p = c/\nu = \lambda$.
- A heavier or faster particle has a **shorter** wavelength.
- A 0.12 kg ball at 20 m/s: $\lambda \approx 2.76 \times 10^{-34}$ m, far too small to measure. That is why everyday objects show no wave behaviour.
- An electron at $5.4 \times 10^6$ m/s: $\lambda \approx 0.135$ nm, similar to X-ray wavelengths and to the spacing of atomic planes in crystals. For electrons, protons and other sub-atomic particles the wave nature is measurable.
- $\lambda$ does not depend on the charge or the kind of particle, only on its momentum.
- The **group velocity** of a matter wave equals the particle's velocity. Its phase velocity has no physical meaning.
