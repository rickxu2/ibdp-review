"""Split selected textbooks into practical upload-sized sections and report sizes."""

from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parents[1]
TEXTBOOK = ROOT / "Textbook"
OUTPUT = ROOT / "tmp" / "pdfs" / "split-test"


def source(prefix: str) -> Path:
    matches = sorted(TEXTBOOK.glob(f"{prefix}*.pdf"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one PDF matching {prefix!r}, found {matches}")
    return matches[0]


BOOKS = {
    "chemistry": {
        "source": source("Oxford_Resources_for_IB_DP_Chemistry"),
        "starts": [
            (1, "00_front_matter"),
            (14, "01_structure_1_particulate_matter"),
            (106, "02_structure_2_bonding_and_structure"),
            (240, "03_structure_3_classification_of_matter"),
            (320, "04_tools_for_chemistry"),
            (398, "05_reactivity_1_driving_reactions"),
            (472, "06_reactivity_2_amount_rate_extent"),
            (548, "07_reactivity_3_mechanisms"),
            (664, "08_cross_topic_questions"),
            (667, "09_inquiry_process"),
            (680, "10_internal_assessment"),
            (698, "11_index"),
            (720, "12_periodic_table"),
        ],
    },
    "physics": {
        "source": source("Physics_"),
        "starts": [
            (1, "00_front_matter"),
            (14, "01_A_space_time_and_motion"),
            (204, "02_B_particulate_nature_of_matter"),
            (340, "03_tools_for_physics"),
            (374, "04_C_wave_behaviour"),
            (480, "05_D_fields"),
            (594, "06_E_nuclear_and_quantum_physics"),
            (708, "07_extended_response_questions"),
            (710, "08_internal_assessment"),
            (716, "09_index"),
            (724, "10_back_matter"),
        ],
    },
    "economics": {
        "source": source("Economics"),
        "starts": [
            (1, "00_front_matter"),
            (6, "00_introduction"),
            *[(page, f"{chapter:02d}_chapter_{chapter:02d}") for chapter, page in enumerate(
                [8, 31, 49, 72, 85, 97, 102, 113, 134, 164, 179, 196, 215, 228,
                 239, 246, 252, 271, 279, 296, 318, 324, 359, 370, 385, 396, 409,
                 427, 445, 459, 481, 526],
                start=1,
            )],
            (542, "33_index"),
        ],
    },
}


def split_book(subject: str, config: dict) -> dict:
    src: Path = config["source"]
    reader = PdfReader(str(src))
    page_count = len(reader.pages)
    starts = config["starts"]
    out_dir = OUTPUT / subject
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for idx, (start, name) in enumerate(starts):
        end = starts[idx + 1][0] - 1 if idx + 1 < len(starts) else page_count
        writer = PdfWriter()
        for page_index in range(start - 1, end):
            writer.add_page(reader.pages[page_index])
        subject_prefix = {"chemistry": "chem_sl", "physics": "phys_hl", "economics": "econ_sl"}[subject]
        out = out_dir / f"{subject_prefix}_{name}_p{start}-{end}.pdf"
        with out.open("wb") as fh:
            writer.write(fh)
        results.append({
            "file": str(out.relative_to(ROOT)),
            "start_page": start,
            "end_page": end,
            "pages": end - start + 1,
            "bytes": out.stat().st_size,
        })

    split_bytes = sum(item["bytes"] for item in results)
    return {
        "subject": subject,
        "source": str(src.relative_to(ROOT)),
        "source_pages": page_count,
        "source_bytes": src.stat().st_size,
        "split_bytes": split_bytes,
        "overhead_bytes": split_bytes - src.stat().st_size,
        "parts": results,
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {subject: split_book(subject, config) for subject, config in BOOKS.items()}
    report_path = OUTPUT / "report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for subject, item in report.items():
        largest = max(item["parts"], key=lambda part: part["bytes"])
        print(
            f"{subject}: {len(item['parts'])} parts, "
            f"source={item['source_bytes'] / 1_000_000:.2f} MB, "
            f"split={item['split_bytes'] / 1_000_000:.2f} MB, "
            f"largest={largest['bytes'] / 1_000_000:.2f} MB "
            f"({largest['file']})"
        )
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
