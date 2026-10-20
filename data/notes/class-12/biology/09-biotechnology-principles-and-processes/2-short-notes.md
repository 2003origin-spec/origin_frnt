---
title: "Biotechnology Principles: Short Notes"
type: short_notes
chapter: c12.biology.biotechnology-principles-and-processes
order: 2
---

## 1. What is biotechnology?

- **Biotechnology** uses live organisms, or enzymes from them, to make products and processes useful to humans.
- Making curd, bread or wine (microbe-mediated) could count. But today the word is used in a narrower sense: processes that use **genetically modified organisms** on a larger scale.
- Also part of biotechnology: in vitro fertilisation ("test-tube" baby), making and using a synthetic gene, a DNA vaccine, correcting a faulty gene.
- **EFB definition** (European Federation of Biotechnology): "The integration of natural science and organisms, cells, parts thereof, and molecular analogues for products and services." It covers both the traditional and the modern molecular view.

## 2. The two core techniques

- **Genetic engineering:** change the chemistry of genetic material (DNA and RNA), put it into a host organism and so change the host's phenotype.
- **Bioprocess engineering:** keep a sterile (no microbial contamination) setup in chemical engineering processes, so only the desired microbe or eukaryotic cell grows, in large amounts. Used to make antibiotics, vaccines, enzymes and more.

## 3. Why genetic engineering?

- Sexual reproduction gives variation; asexual reproduction keeps the genetic information the same.
- Traditional hybridisation in plant and animal breeding often carries **undesirable genes** along with the desired ones.
- Genetic engineering (recombinant DNA, gene cloning, gene transfer) lets us move **only one or a set of desirable genes**.

:::remember
An alien piece of DNA usually **cannot multiply** in a new organism. It multiplies only if it becomes part of a chromosome, or is linked to an **origin of replication** (ori), the sequence that starts replication. Making many identical copies of a template DNA is **cloning**.
:::

## 4. The first recombinant DNA (1972)

- **Stanley Cohen and Herbert Boyer** cut an antibiotic resistance gene out of a plasmid, using restriction enzymes ("molecular scissors").
- They linked it to a native **plasmid** of ***Salmonella typhimurium***. A plasmid is autonomously replicating, circular, extra-chromosomal DNA.
- **DNA ligase** joined the ends. The new circular DNA, made in vitro, is **recombinant DNA**.
- It was put into ***Escherichia coli***, a bacterium closely related to *Salmonella*. There it was copied by the host's DNA polymerase. This was **cloning** of the antibiotic resistance gene in *E. coli*.
- The plasmid acted as a **vector**: like a mosquito carrying the malarial parasite, it carries the DNA into the host.

:::remember
Three basic steps in genetically modifying an organism:
1. Identify the DNA with the desirable genes.
2. Introduce that DNA into the host.
3. Maintain the DNA in the host and pass it to the host's progeny.
:::

## 5. Tools of recombinant DNA technology

Key tools: **restriction enzymes, polymerase enzymes, ligases, vectors and the host organism.**

### Restriction enzymes

- In **1963**, two enzymes that restrict the growth of bacteriophage in *E. coli* were isolated. One added **methyl groups** to DNA; the other **cut** DNA. The cutting one is a **restriction endonuclease**.
- The first restriction endonuclease whose action depended on a specific sequence, **Hind II**, was isolated five years later. It always cut at a particular point after recognising a sequence of **six base pairs**: its **recognition sequence**.
- Today more than **900** restriction enzymes are known, from over **230** strains of bacteria. Each recognises a different sequence.

:::remember
**Naming (EcoRI):** first letter from the **genus**, next two from the **species**, then the **strain**, then a Roman number for the **order of isolation** from that strain.
- E = *Escherichia*, co = *coli*, R = strain RY 13, I = first enzyme from that strain.
:::

- Restriction enzymes are **nucleases**. **Exonucleases** remove nucleotides from the **ends** of DNA. **Endonucleases** cut at specific positions **within** DNA.
- An endonuclease "inspects" the DNA. When it finds its recognition sequence, it binds and cuts **both strands** at specific points in the **sugar-phosphate backbone**.

### Palindromes and sticky ends

- Each restriction endonuclease recognises a specific **palindromic** sequence.
- A DNA palindrome reads the **same on the two strands** when read in the same direction (5′ → 3′ on both, or 3′ → 5′ on both). Example, the EcoRI site:

$$\begin{aligned} & 5' \text{ — GAATTC — } 3' \\ & 3' \text{ — CTTAAG — } 5' \end{aligned}$$

- Restriction enzymes cut a little **away from the centre** of the palindrome, but **between the same two bases** on both strands. EcoRI cuts **between G and A**.
- This leaves single-stranded overhangs: **sticky ends** (AATT for EcoRI). They are "sticky" because they form **hydrogen bonds** with their complementary cut partners. This helps DNA ligase join them.
- Cut the **vector and the source DNA with the same enzyme**: both get the same sticky ends, and ligase can join them. Normally, without this, a recombinant vector cannot be made.

### Gel electrophoresis

- Restriction digestion gives DNA fragments. They are separated by **gel electrophoresis**.
- DNA is **negatively charged**, so it moves towards the **anode** (positive electrode) in an electric field.
- The matrix now most used is **agarose**, a natural polymer from **sea weeds**. It sieves the fragments by size: the **smaller the fragment, the farther it moves**.
- DNA is seen only after staining with **ethidium bromide** and exposing to **UV** light: bright **orange** bands. Pure DNA cannot be seen in visible light without staining.
- Bands are cut out of the gel and the DNA extracted: **elution**. The purified fragments are joined to cloning vectors.

### Cloning vectors

- **Plasmids and bacteriophages** replicate inside bacteria independently of chromosomal DNA. Phages have very high copy numbers. Some plasmids have 1–2 copies per cell, others 15–100 or more.
- Linked foreign DNA is multiplied to the vector's copy number.

Features a cloning vector needs:

1. **Origin of replication (ori):** replication starts here. It also **controls the copy number**. For many copies, use a vector whose ori supports a high copy number.
2. **Selectable marker:** helps identify and eliminate **non-transformants** and lets only **transformants** grow. Genes for resistance to ampicillin, chloramphenicol, tetracycline or kanamycin are useful markers for *E. coli*; normal *E. coli* resists none of these. (**Transformation:** putting a piece of DNA into a host bacterium.)
3. **Cloning sites:** very few, preferably **single**, recognition sites for common restriction enzymes. More sites give several fragments and complicate cloning.
4. **Vectors for plants and animals** (see below).

### pBR322 and selecting recombinants

- *E. coli* vector **pBR322** has ori, **rop** (proteins for plasmid replication), and two resistance genes, $\text{amp}^R$ and $\text{tet}^R$. Figure 9.4 labels Hind III, EcoR I, BamH I, Sal I, Pvu I, Pvu II, Pst I and Cla I (its caption lists Pvu II only). BamH I and Sal I lie in $\text{tet}^R$; Pst I and Pvu I in $\text{amp}^R$.
- Insert foreign DNA at the **BamH I** site in $\text{tet}^R$. The recombinant plasmid **loses tetracycline resistance** but keeps ampicillin resistance.

| Plate | Recombinant | Non-recombinant |
| --- | --- | --- |
| Ampicillin | Grows | Grows |
| Tetracycline | **Does not grow** | Grows |

- One resistance gene selects **transformants**; the other, **inactivated by insertion**, selects **recombinants**.
- This is **cumbersome**: it needs plating on two plates with different antibiotics.

### Blue-white selection (insertional inactivation)

- The insert goes into the coding sequence of the enzyme **β-galactosidase**, which inactivates the gene: **insertional inactivation**.
- With a **chromogenic substrate**:
  - no insert → enzyme works → **blue** colonies (non-recombinant);
  - insert present → no enzyme → **colourless** colonies (**recombinant**).

### Vectors for plants and animals

- ***Agrobacterium tumifaciens*** (NCERT's spelling; usually written *tumefaciens*), a pathogen of several **dicot** plants, delivers a piece of DNA, **T-DNA**, that turns normal plant cells into a **tumor**. The tumor cells make chemicals the pathogen needs.
- Its **Ti plasmid** (tumor inducing) has been modified into a cloning vector: no longer pathogenic, but it still delivers our genes into many plants.
- **Retroviruses** turn normal animal cells cancerous. **Disarmed** retroviruses now deliver desirable genes into animal cells.

### Competent host

- DNA is **hydrophilic**, so it cannot pass through cell membranes.
- Bacteria are made **competent** by treating them with a specific concentration of a **divalent cation**, such as **calcium**. This helps DNA enter through pores in the cell wall.
- Then: incubate cells with recombinant DNA **on ice** → brief **heat shock at 42 °C** → back **on ice**. The bacteria take up the DNA.

Other ways to get DNA in:

| Method | Cells | How |
| --- | --- | --- |
| Micro-injection | Animal | DNA injected into the **nucleus** |
| Biolistics (gene gun) | Plant | High-velocity **gold or tungsten** particles coated with DNA |
| Disarmed pathogen | Plant, animal | The vector infects the cell and transfers the DNA |

## 6. Processes of recombinant DNA technology

Steps in order: isolate DNA → cut it with restriction endonucleases → isolate the desired fragment → ligate it into a vector → transfer into the host → culture the host at large scale → extract the product.

### Isolating DNA

- DNA must be **pure**, free from other macromolecules, before it can be cut.
- Break the cells open with enzymes: **lysozyme** (bacteria), **cellulase** (plant cells), **chitinase** (fungus).
- Remove RNA with **ribonuclease** and proteins (like histones) with **protease**. Other molecules are removed by suitable treatments.
- Purified DNA **precipitates** on adding **chilled ethanol**. It is seen as fine threads and removed by **spooling**.

### Cutting DNA

- Incubate pure DNA with the restriction enzyme at the optimal conditions for that enzyme.
- **Agarose gel electrophoresis** checks how far the digestion has gone.
- Repeat with the vector DNA. Mix the cut "gene of interest" with the cut vector, add **ligase**: recombinant DNA.

### PCR (Polymerase Chain Reaction)

- Makes many copies of a gene or DNA in vitro using **two sets of primers** (short, chemically synthesised oligonucleotides complementary to the DNA) and **DNA polymerase**.
- Each cycle has three steps: **denaturation** (heat separates the strands) → **primer annealing** → **extension** of primers.
- Repeated many times, the segment is amplified about **a billion times** (NCERT's figure: 30 cycles).
- A **thermostable** DNA polymerase from ***Thermus aquaticus*** (**Taq polymerase**) stays active at the high temperature of denaturation.
- The amplified DNA can then be ligated into a vector.

### Inserting rDNA into the host

- Competent cells take up DNA from their surroundings.
- If the rDNA carries ampicillin resistance, transformed *E. coli* become **ampicillin-resistant**. On ampicillin agar plates, only **transformants grow**; untransformed cells die. Here the ampicillin resistance gene is the **selectable marker**.

### Getting the foreign gene product

- The usual aim is a **protein**, so the foreign gene must be **expressed**, under suitable conditions.
- A protein made by expressing a gene in a **heterologous** host is a **recombinant protein**.
- Small-scale lab cultures can be used to extract and purify the protein.
- **Continuous culture:** used medium is drained from one side and fresh medium added from the other. This keeps cells in the **log/exponential phase** and gives more biomass and more protein.

### Bioreactors

- Small cultures cannot give enough product. **Bioreactors** handle **100–1000 litres**.
- A bioreactor is a vessel where raw materials are biologically converted into products, using microbial, plant, animal or human cells.
- It gives optimum growth conditions: **temperature, pH, substrate, salts, vitamins, oxygen**.
- Most common: **stirring type**.
  - **Simple stirred-tank:** the stirrer mixes evenly and spreads oxygen.
  - **Sparged stirred-tank:** sterile air bubbles are sparged (bubbled) through.
- A stirred tank is usually **cylindrical** or has a **curved base** for mixing. Parts: agitator system, oxygen delivery system, foam control system, temperature control system, pH control system, and **sampling ports** to take out small volumes.

### Downstream processing

- After the biosynthetic stage, the product is **separated and purified**. Together these are **downstream processing**.
- The product is **formulated** with suitable **preservatives**.
- Drugs go through thorough **clinical trials**. Every product needs strict **quality control**.
- Downstream processing and quality control **vary from product to product**.
