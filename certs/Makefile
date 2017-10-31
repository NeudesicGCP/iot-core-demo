# (Re-)Generate certificate files for IoT Core demo
#
# Dependencies: cfssl installed and on path; use `go get github.com/cloudflare/cfssl/cmd/...` to install.
#
#
# 1. CA cert and key is special; recreation will break any existing cert-key pairs that are in use.
# CA is automatically created if missing and a device cert is requested (see below).
# CA cert can be manually created by:-
# $ make ca.pem
# which will generate the files ca.pem and ca-key.pem. These must be uploaded to Cloud IoT Core registry, and provided
# to the custom registry service API.
#
# 2. For testing, create a device certificate and key by doing make _name_.pem where _name_ is the CN name to use.
# E.g. to create a cert with CN=foobar, do
# $ make foobar.pem
# Above command will create foobar.pem (Cert), foobar-key.pem (private key) files in current dir.
# Cert will have CN=foobar as subject.

BASE_DIR:=$(dir $(realpath $(firstword $(MAKEFILE_LIST))))
CONFIG := $(BASE_DIR)/iot-core-demo-config.json
ROOT_CA := $(BASE_DIR)/ca.pem

# When on Windows, force shell to be cmd instead of bash or any other shell
ifeq ($(OS),Windows_NT)
SHELL=cmd.exe
endif

# Template for device certs
define device-csr-content
{
  "CN": "!!name!!",
  "hosts": [
  ],
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Irvine",
      "O": "Neudesic",
      "OU": "GCP",
      "ST": "California"
    }
  ]
}
endef

# Delete all certs, keys and csr's, except for those used by the CA
clean:
	-rm $(filter-out ca.pem ca-key.pem ca-csr.json iot-core-demo-config.json,$(wildcard *pem *csr *json))

# Clean-up the CA files too
realclean: clean
	-rm $(ROOT_CA) $(subst ca,ca-key,$(ROOT_CA))


# Create a CA cert from CSR file
ca.pem: ca-csr.json
	cfssl gencert -initca $< | cfssljson -bare $(subst .pem,,$@)

# Create a device cert signing request from template, with CN taken from file name
%-csr.json:
	$(file >$@,$(subst !!name!!,$(subst -csr.json,,$@),$(device-csr-content)))

# General rule to generate a device cert 
%.pem: %-csr.json ca.pem
	cfssl gencert -ca $(ROOT_CA) -ca-key $(subst ca,ca-key,$(ROOT_CA)) -config $(CONFIG) -profile device $< | \
	cfssljson -bare $(subst .pem,,$@)

.PHONY: all clean realclean
