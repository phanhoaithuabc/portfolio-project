import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import type {
  PortfolioBlock,
  PortfolioBlockTranslation,
  PortfolioMediaItem,
  PortfolioMetric,
} from "@portfolio/contracts";
import type { PortfolioMediaFile } from "../lib/api";

const blockTypes = [
  ["text", "Text"],
  ["image", "Image"],
  ["gallery", "Gallery"],
  ["video", "Video embed"],
  ["metrics", "Results / metrics"],
] as const;

function newBlock(type: PortfolioBlock["type"]): PortfolioBlock {
  return {
    id: crypto.randomUUID(),
    type,
    heading: "",
    body: type === "text" ? "Write the story behind this section." : "",
    image: "",
    imageAlt: "",
    caption: "",
    images:
      type === "gallery"
        ? [{ id: crypto.randomUUID(), url: "", alt: "", caption: "" }]
        : [],
    videoUrl: "",
    metrics:
      type === "metrics"
        ? [{ id: crypto.randomUUID(), label: "Result", value: "" }]
        : [],
  };
}

export function SectionEditor({
  sections,
  translations = [],
  media = [],
  onChange,
  onTranslationsChange,
}: {
  sections: PortfolioBlock[];
  translations?: PortfolioBlockTranslation[];
  media?: PortfolioMediaFile[];
  onChange: (sections: PortfolioBlock[]) => void;
  onTranslationsChange: (sections: PortfolioBlockTranslation[]) => void;
}) {
  function update(index: number, patch: Partial<PortfolioBlock>) {
    onChange(
      sections.map((section, current) =>
        current === index ? { ...section, ...patch } : section,
      ),
    );
  }
  function updateTranslation(
    id: string,
    patch: Partial<PortfolioBlockTranslation>,
  ) {
    const current = translations.find((item) => item.id === id);
    const next = translations.filter((item) => item.id !== id);
    onTranslationsChange([...next, { id, ...current, ...patch }]);
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function updateImage(
    blockIndex: number,
    imageIndex: number,
    patch: Partial<PortfolioMediaItem>,
  ) {
    const images = [...(sections[blockIndex].images ?? [])];
    images[imageIndex] = { ...images[imageIndex], ...patch };
    update(blockIndex, { images });
  }
  function updateMetric(
    blockIndex: number,
    metricIndex: number,
    patch: Partial<PortfolioMetric>,
  ) {
    const metrics = [...(sections[blockIndex].metrics ?? [])];
    metrics[metricIndex] = { ...metrics[metricIndex], ...patch };
    update(blockIndex, { metrics });
  }
  return (
    <section
      className="section-editor field-wide"
      aria-label="Case-study sections"
    >
      <div className="section-editor-heading">
        <div>
          <span className="small-label">STORY BLOCKS</span>
          <p>
            Arrange content in reading order. Media URLs must use HTTPS or the
            portfolio media library.
          </p>
        </div>
        <div className="section-add-actions">
          {blockTypes.map(([type, label]) => (
            <button
              key={type}
              type="button"
              className="text-button"
              onClick={() => onChange([...sections, newBlock(type)])}
            >
              <Plus size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>
      {!sections.length && (
        <p className="section-empty">
          No sections yet. Add a text block, image gallery, video, or measurable
          result.
        </p>
      )}
      {sections.map((section, index) => {
        const translation = translations.find((item) => item.id === section.id);
        return (
          <article className="section-block-editor" key={section.id}>
            <div className="section-block-toolbar">
              <strong>
                {String(index + 1).padStart(2, "0")} /{" "}
                {blockTypes.find(([type]) => type === section.type)?.[1]}
              </strong>
              <div>
                <button
                  type="button"
                  className="icon-button"
                  title="Move section up"
                  aria-label="Move section up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Move section down"
                  aria-label="Move section down"
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  title="Remove section"
                  aria-label="Remove section"
                  onClick={() => {
                    onChange(
                      sections.filter((_, current) => current !== index),
                    );
                    onTranslationsChange(
                      translations.filter((item) => item.id !== section.id),
                    );
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <label>
              Section heading
              <input
                maxLength={180}
                value={section.heading}
                onChange={(event) =>
                  update(index, { heading: event.target.value })
                }
              />
            </label>
            {section.type === "text" && (
              <label>
                Body
                <textarea
                  rows={6}
                  maxLength={6000}
                  value={section.body}
                  onChange={(event) =>
                    update(index, { body: event.target.value })
                  }
                />
              </label>
            )}
            {section.type === "image" && (
              <>
                <label>
                  Image URL
                  <input
                    type="url"
                    list={`media-${section.id}`}
                    maxLength={2000}
                    value={section.image ?? ""}
                    onChange={(event) =>
                      update(index, { image: event.target.value })
                    }
                  />
                  <datalist id={`media-${section.id}`}>
                    {media.map((item) => (
                      <option key={item.id} value={item.url} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Alt text
                  <input
                    maxLength={300}
                    value={section.imageAlt}
                    onChange={(event) =>
                      update(index, { imageAlt: event.target.value })
                    }
                  />
                </label>
                <label>
                  Caption
                  <input
                    maxLength={500}
                    value={section.caption}
                    onChange={(event) =>
                      update(index, { caption: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            {section.type === "gallery" && (
              <div className="section-gallery-editor">
                <span className="small-label">
                  <ImagePlus size={13} /> GALLERY ITEMS
                </span>
                {(section.images ?? []).map((image, imageIndex) => (
                  <div className="section-media-row" key={image.id}>
                    <label>
                      Image URL
                      <input
                        type="url"
                        list={`media-${section.id}`}
                        maxLength={2000}
                        value={image.url}
                        onChange={(event) =>
                          updateImage(index, imageIndex, {
                            url: event.target.value,
                          })
                        }
                      />
                    </label>
                    <datalist id={`media-${section.id}`}>
                      {media.map((item) => (
                        <option key={item.id} value={item.url} />
                      ))}
                    </datalist>
                    <label>
                      Alt text
                      <input
                        maxLength={300}
                        value={image.alt}
                        onChange={(event) =>
                          updateImage(index, imageIndex, {
                            alt: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Caption
                      <input
                        maxLength={500}
                        value={image.caption}
                        onChange={(event) =>
                          updateImage(index, imageIndex, {
                            caption: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      title="Remove image"
                      aria-label="Remove image"
                      disabled={(section.images ?? []).length <= 1}
                      onClick={() =>
                        update(index, {
                          images: (section.images ?? []).filter(
                            (_, current) => current !== imageIndex,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  disabled={(section.images ?? []).length >= 20}
                  onClick={() =>
                    update(index, {
                      images: [
                        ...(section.images ?? []),
                        {
                          id: crypto.randomUUID(),
                          url: "",
                          alt: "",
                          caption: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={15} /> Add image
                </button>
              </div>
            )}
            {section.type === "video" && (
              <>
                <label>
                  YouTube or Vimeo URL
                  <input
                    type="url"
                    maxLength={2000}
                    value={section.videoUrl ?? ""}
                    onChange={(event) =>
                      update(index, { videoUrl: event.target.value })
                    }
                  />
                </label>
                <label>
                  Accessible video title
                  <input
                    maxLength={500}
                    value={section.caption}
                    onChange={(event) =>
                      update(index, { caption: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            {section.type === "metrics" && (
              <div className="section-gallery-editor">
                <span className="small-label">RESULTS</span>
                {(section.metrics ?? []).map((metric, metricIndex) => (
                  <div className="section-metric-row" key={metric.id}>
                    <label>
                      Value
                      <input
                        maxLength={80}
                        value={metric.value}
                        onChange={(event) =>
                          updateMetric(index, metricIndex, {
                            value: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Label
                      <input
                        maxLength={80}
                        value={metric.label}
                        onChange={(event) =>
                          updateMetric(index, metricIndex, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      title="Remove metric"
                      aria-label="Remove metric"
                      disabled={(section.metrics ?? []).length <= 1}
                      onClick={() =>
                        update(index, {
                          metrics: (section.metrics ?? []).filter(
                            (_, current) => current !== metricIndex,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  disabled={(section.metrics ?? []).length >= 8}
                  onClick={() =>
                    update(index, {
                      metrics: [
                        ...(section.metrics ?? []),
                        { id: crypto.randomUUID(), label: "Result", value: "" },
                      ],
                    })
                  }
                >
                  <Plus size={15} /> Add result
                </button>
              </div>
            )}
            <details className="section-translation">
              <summary>Vietnamese section text</summary>
              <label>
                Heading
                <input
                  maxLength={180}
                  value={translation?.heading ?? ""}
                  onChange={(event) =>
                    updateTranslation(section.id, {
                      heading: event.target.value,
                    })
                  }
                />
              </label>
              {section.type === "text" && (
                <label>
                  Body
                  <textarea
                    rows={5}
                    maxLength={6000}
                    value={translation?.body ?? ""}
                    onChange={(event) =>
                      updateTranslation(section.id, {
                        body: event.target.value,
                      })
                    }
                  />
                </label>
              )}
              {section.type === "image" && (
                <>
                  <label>
                    Alt text
                    <input
                      maxLength={300}
                      value={translation?.imageAlt ?? ""}
                      onChange={(event) =>
                        updateTranslation(section.id, {
                          imageAlt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Caption
                    <input
                      maxLength={500}
                      value={translation?.caption ?? ""}
                      onChange={(event) =>
                        updateTranslation(section.id, {
                          caption: event.target.value,
                        })
                      }
                    />
                  </label>
                </>
              )}
              {section.type === "video" && (
                <label>
                  Accessible video title
                  <input
                    maxLength={500}
                    value={translation?.caption ?? ""}
                    onChange={(event) =>
                      updateTranslation(section.id, {
                        caption: event.target.value,
                      })
                    }
                  />
                </label>
              )}
              {section.type === "gallery" && (
                <div className="section-gallery-editor">
                  {(section.images ?? []).map((image) => {
                    const localized =
                      translation?.images?.find(
                        (item) => item.id === image.id,
                      ) ?? image;
                    const updateLocalizedImage = (
                      patch: Partial<PortfolioMediaItem>,
                    ) => {
                      const images = [
                        ...(translation?.images ?? section.images ?? []),
                      ];
                      const index = images.findIndex(
                        (item) => item.id === image.id,
                      );
                      images[index] = { ...images[index], ...patch };
                      updateTranslation(section.id, { images });
                    };
                    return (
                      <div className="section-media-row" key={image.id}>
                        <label>
                          Vietnamese alt text
                          <input
                            maxLength={300}
                            value={localized.alt}
                            onChange={(event) =>
                              updateLocalizedImage({ alt: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          Vietnamese caption
                          <input
                            maxLength={500}
                            value={localized.caption}
                            onChange={(event) =>
                              updateLocalizedImage({
                                caption: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
              {section.type === "metrics" && (
                <div className="section-gallery-editor">
                  {(section.metrics ?? []).map((metric) => {
                    const localized =
                      translation?.metrics?.find(
                        (item) => item.id === metric.id,
                      ) ?? metric;
                    const updateLocalizedMetric = (
                      patch: Partial<PortfolioMetric>,
                    ) => {
                      const metrics = [
                        ...(translation?.metrics ?? section.metrics ?? []),
                      ];
                      const index = metrics.findIndex(
                        (item) => item.id === metric.id,
                      );
                      metrics[index] = { ...metrics[index], ...patch };
                      updateTranslation(section.id, { metrics });
                    };
                    return (
                      <div className="section-metric-row" key={metric.id}>
                        <label>
                          Vietnamese value
                          <input
                            maxLength={80}
                            value={localized.value}
                            onChange={(event) =>
                              updateLocalizedMetric({
                                value: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Vietnamese label
                          <input
                            maxLength={80}
                            value={localized.label}
                            onChange={(event) =>
                              updateLocalizedMetric({
                                label: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </details>
          </article>
        );
      })}
    </section>
  );
}
