BASE_DIR:=$(dir $(realpath $(firstword $(MAKEFILE_LIST))))
CERTS_DIR=$(BASE_DIR)/certs
THINGY_DIR=$(BASE_DIR)/thingy
REGISTRY_DIR=$(BASE_DIR)/registry

# When on Windows, force shell to be cmd instead of bash or any other shell
ifeq ($(OS),Windows_NT)
SHELL=cmd.exe
endif

all: thingy registry

# Make sure the CA certificate is up-to date
ca:
	$(MAKE) -C $(CERTS_DIR) ca.pem

# Build and deploy thingy to app engine
thingy:
ifeq ($(OS),Windows_NT)
	cd $(THINGY_DIR); ng build --prod; gcloud app deploy --quiet
else
	cd $(THINGY_DIR) && ng build --prod && gcloud app deploy --quiet
endif

# Build and deploy registry to app engine
# Note: the CA pem files must be uploaded to app engine too
registry: ca
ifeq ($(OS),Windows_NT)
	copy $(CERTS_DIR)\\ca.pem $(CERTS_DIR)\\ca-key.pem $(REGISTRY_DIR)\\
	cd $(REGISTRY_DIR); gcloud app deploy --quiet
else
	cp $(CERTS_DIR)/ca.pem $(CERTS_DIR)/ca-key.pem $(REGISTRY_DIR)/
	cd $(REGISTRY_DIR) && gcloud app deploy --quiet
endif

.PHONY: ca thingy registry all
