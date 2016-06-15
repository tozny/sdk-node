.PHONY: all build clean

babel      := node_modules/.bin/babel
src_files  := $(shell find src/ -name '*.js')
out_files  := $(patsubst src/%.js,lib/%.js,$(src_files))
type_files := $(patsubst src/%.js,lib/%.js.flow,$(src_files))
map_files  := $(patsubst src/%.js,lib/%.js.map,$(src_files))

all: build

build: $(out_files) $(type_files)

lib/%.js: src/%.js
	$(babel) $< --out-file $@ --source-maps

lib/%.js.flow: src/%.js
	cp $< $@

clean:
	rm -f $(out_files) $(type_files) $(map_files)
